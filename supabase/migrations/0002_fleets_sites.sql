-- Iteration 3: fleets + sites + machine assignment.
-- Adds two new tables (fleets, sites), two new columns on machines
-- (fleet_id, site_id), RLS, and backfills every existing account with
-- a default "Your fleet" containing all its existing machines.

-- ─── fleets ─────────────────────────────────────────────────────────────────
create table fleets (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts(id) on delete cascade,
  name        text not null,
  slug        text not null,
  color       text,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id),
  unique (account_id, slug)
);
create index fleets_account_idx on fleets(account_id);

-- ─── sites ──────────────────────────────────────────────────────────────────
create table sites (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references accounts(id) on delete cascade,
  fleet_id    uuid not null references fleets(id) on delete cascade,
  name        text not null,
  address     text,
  latitude    double precision,
  longitude   double precision,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id)
);
create index sites_fleet_idx   on sites(fleet_id);
create index sites_account_idx on sites(account_id);

-- ─── machines: add fleet_id + site_id ───────────────────────────────────────
alter table machines add column fleet_id uuid references fleets(id) on delete set null;
alter table machines add column site_id  uuid references sites(id)  on delete set null;
create index machines_fleet_idx on machines(fleet_id);
create index machines_site_idx  on machines(site_id);

-- ─── RLS ────────────────────────────────────────────────────────────────────
alter table fleets enable row level security;
alter table sites  enable row level security;

create policy fleets_all on fleets for all
  using (is_member_of(account_id))
  with check (is_member_of(account_id));

create policy sites_all on sites for all
  using (is_member_of(account_id))
  with check (is_member_of(account_id));

-- ─── Backfill: every existing account gets a "Your fleet" ───────────────────
-- All existing machines move into it so the fleet-required UX doesn't break
-- for legacy data.
do $$
declare
  acct        record;
  fleet_uuid  uuid;
begin
  for acct in select id, created_by from accounts loop
    insert into fleets (account_id, name, slug, created_by)
    values (acct.id, 'Your fleet', 'your-fleet', acct.created_by)
    returning id into fleet_uuid;

    update machines
       set fleet_id = fleet_uuid
     where account_id = acct.id;
  end loop;
end $$;
