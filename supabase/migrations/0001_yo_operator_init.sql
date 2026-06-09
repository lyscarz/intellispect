-- IntelliCheck — iteration 1 schema.
-- Tables/enums/policies for: accounts, account members, telematics connections, machines.
-- Iter 2 features (invites, roles, platform admins) are scaffolded but unused in iter 1.

create extension if not exists citext;
create extension if not exists "pgcrypto";

-- ─── Enums ───────────────────────────────────────────────────────────────────
create type account_role        as enum ('account_admin', 'admin_user', 'operator');
create type machine_source      as enum ('manual', 'trackunit');
create type telematics_provider as enum ('trackunit');
create type machine_status      as enum ('active', 'disconnected', 'orphaned');

-- ─── Accounts ────────────────────────────────────────────────────────────────
create table accounts (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table account_members (
  account_id uuid references accounts(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete cascade,
  role       account_role not null,
  joined_at  timestamptz not null default now(),
  primary key (account_id, user_id)
);

-- super_admin lives here; no UI in iter 1.
create table platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

-- Iter 2 — table created so accept-invite ships without a migration.
create table account_invites (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts(id) on delete cascade,
  email       citext not null,
  role        account_role not null,
  token       text unique not null,
  invited_by  uuid not null references auth.users(id),
  expires_at  timestamptz not null,
  accepted_at timestamptz
);

-- ─── Telematics connections ──────────────────────────────────────────────────
create table telematics_connections (
  id                    uuid primary key default gen_random_uuid(),
  account_id            uuid not null references accounts(id) on delete cascade,
  provider              telematics_provider not null,
  label                 text,
  credentials_encrypted bytea not null,
  credentials_nonce     bytea not null,
  status                text not null default 'active',  -- 'active' | 'revoked' | 'error'
  last_verified_at      timestamptz,
  created_at            timestamptz not null default now(),
  created_by            uuid references auth.users(id)
);
-- Only one active connection per provider per account.
create unique index telematics_one_active
  on telematics_connections (account_id, provider)
  where status = 'active';

-- ─── Machines ────────────────────────────────────────────────────────────────
create table machines (
  id                   uuid primary key default gen_random_uuid(),
  account_id           uuid not null references accounts(id) on delete cascade,
  source               machine_source not null,
  source_external_id   text,                                              -- Trackunit assetId; null for manual
  source_connection_id uuid references telematics_connections(id) on delete set null,
  status               machine_status not null default 'active',
  name                 text not null,
  brand                text,
  model                text,
  serial_number        text,
  site                 text,
  image_path           text,                                              -- Supabase Storage object key
  last_snapshot        jsonb,                                             -- Asset shape from lib/types.ts
  last_synced_at       timestamptz,
  created_at           timestamptz not null default now(),
  created_by           uuid references auth.users(id),
  unique (account_id, source, source_external_id)
);
create index machines_account_idx        on machines (account_id);
create index machines_account_source_idx on machines (account_id, source);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

-- Helper: caller is a member of the given account, or a platform admin.
create or replace function is_member_of(aid uuid) returns boolean
  language sql security definer stable
  set search_path = public
as $$
  select exists(select 1 from account_members where account_id = aid and user_id = auth.uid())
      or exists(select 1 from platform_admins  where user_id = auth.uid());
$$;

alter table accounts                 enable row level security;
alter table account_members          enable row level security;
alter table platform_admins          enable row level security;
alter table account_invites          enable row level security;
alter table telematics_connections   enable row level security;
alter table machines                 enable row level security;

-- Accounts: members can read; only the creator/inserter row uses auth.uid() for inserts.
create policy accounts_select on accounts for select using (is_member_of(id));
create policy accounts_insert on accounts for insert with check (created_by = auth.uid());

-- account_members: members read; member insert is guarded by an explicit server-side check (no policy here for inserts → done via service role on first signup).
create policy members_select on account_members for select using (is_member_of(account_id));

-- platform_admins: only platform admins can read themselves; no inserts via API.
create policy platform_admins_select on platform_admins for select using (user_id = auth.uid());

-- Invites: members can read invites for their account.
create policy invites_select on account_invites for select using (is_member_of(account_id));

-- Telematics connections: members can do everything; service-side enforces admin role.
create policy connections_all on telematics_connections for all
  using (is_member_of(account_id))
  with check (is_member_of(account_id));

-- Machines: members can do everything.
create policy machines_all on machines for all
  using (is_member_of(account_id))
  with check (is_member_of(account_id));

-- ─── Storage bucket for machine images ───────────────────────────────────────
-- Run after this migration (one-time, in SQL editor):
--   insert into storage.buckets (id, name, public) values ('machine-images', 'machine-images', false);
--
--   create policy "machine-images read"  on storage.objects for select
--     using (bucket_id = 'machine-images' and is_member_of((storage.foldername(name))[1]::uuid));
--   create policy "machine-images write" on storage.objects for insert
--     with check (bucket_id = 'machine-images' and is_member_of((storage.foldername(name))[1]::uuid));
--   create policy "machine-images update" on storage.objects for update
--     using (bucket_id = 'machine-images' and is_member_of((storage.foldername(name))[1]::uuid));
--   create policy "machine-images delete" on storage.objects for delete
--     using (bucket_id = 'machine-images' and is_member_of((storage.foldername(name))[1]::uuid));
