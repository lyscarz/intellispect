-- Iteration 9: user management.
-- Adds fleet-scoped access for members within an account and lets invites be
-- pre-scoped at creation time.

-- ─── Per-member fleet access ─────────────────────────────────────────────────
-- Junction table: rows here grant a (user_id) access to specific fleets within
-- (account_id). Rule (enforced in lib/fleet-access.ts):
--   account_admin   → unrestricted (rows here ignored)
--   admin_user      → scoped to the fleet_ids in this table.
--                     If no rows exist for them, they can see nothing.
--   operator        → same scoping rule as admin_user.

create table member_fleet_access (
  account_id uuid not null references accounts(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  fleet_id   uuid not null references fleets(id) on delete cascade,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users(id),
  primary key (account_id, user_id, fleet_id)
);
create index member_fleet_access_user_idx on member_fleet_access (account_id, user_id);

alter table member_fleet_access enable row level security;

create policy member_fleet_access_all on member_fleet_access for all
  using (is_member_of(account_id))
  with check (is_member_of(account_id));

-- ─── Invite pre-scoping ──────────────────────────────────────────────────────
-- Inviter picks which fleets the invitee will get at accept time. Empty array
-- means "no fleets" — for account_admin invites we set it to '{}' since the
-- rule says account_admin is unrestricted regardless.
alter table account_invites
  add column if not exists allowed_fleet_ids uuid[] not null default '{}';
