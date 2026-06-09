-- Iteration 5: assign inspection templates to machines.
-- A template can be assigned to: all machines, a site, a machine type
-- (derived from machines.last_snapshot->>'assetType'), or a single machine.
-- Multiple assignments per template are allowed; a machine matches a template
-- if ANY assignment row applies (UNION semantics in the resolver).

create type inspection_assignment_kind as enum ('all', 'site', 'type', 'machine');

create table inspection_assignments (
  id           uuid primary key default gen_random_uuid(),
  account_id   uuid not null references accounts(id) on delete cascade,
  template_id  uuid not null references inspection_templates(id) on delete cascade,
  target_kind  inspection_assignment_kind not null,
  -- site_id or machine_id when target_kind in ('site', 'machine'); null otherwise.
  -- No FK on purpose — deleting a site/machine leaves the row dangling and the
  -- resolver simply stops matching it. Avoids cross-table cascades.
  target_id    uuid,
  -- The type string (e.g. 'EXCAVATOR') when target_kind = 'type'; null otherwise.
  target_value text,
  created_at   timestamptz not null default now(),
  created_by   uuid references auth.users(id),

  check (
    (target_kind = 'all'     and target_id is null     and target_value is null) or
    (target_kind = 'site'    and target_id is not null and target_value is null) or
    (target_kind = 'machine' and target_id is not null and target_value is null) or
    (target_kind = 'type'    and target_id is null     and target_value is not null)
  )
);

-- Prevent duplicate rules per template.
create unique index inspection_assignments_unique on inspection_assignments (
  template_id,
  target_kind,
  coalesce(target_id::text, ''),
  coalesce(target_value, '')
);

create index inspection_assignments_account_idx  on inspection_assignments (account_id);
create index inspection_assignments_template_idx on inspection_assignments (template_id);
create index inspection_assignments_site_idx     on inspection_assignments (target_id) where target_kind = 'site';
create index inspection_assignments_machine_idx  on inspection_assignments (target_id) where target_kind = 'machine';

alter table inspection_assignments enable row level security;

create policy inspection_assignments_all on inspection_assignments for all
  using (is_member_of(account_id))
  with check (is_member_of(account_id));
