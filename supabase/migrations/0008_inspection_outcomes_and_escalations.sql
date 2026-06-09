-- Iteration 8: outcome chips + escalations.
--   - Adds `outcome` ('pass' | 'attention' | 'fail') to both run tables so the
--     /inspection-history list and detail can show a status pill at a glance.
--   - New inspection_escalations table for record-only escalations to
--     manager / service / event. Real delivery is deferred.

-- ─── Outcomes ───────────────────────────────────────────────────────────────
alter table inspection_responses    add column if not exists outcome text;
alter table inspection_intent_runs  add column if not exists outcome text;

create index if not exists inspection_responses_outcome_idx
  on inspection_responses (account_id, outcome);
create index if not exists inspection_intent_runs_outcome_idx
  on inspection_intent_runs (account_id, outcome);

-- ─── Escalations ────────────────────────────────────────────────────────────
create type inspection_escalation_kind   as enum ('manager', 'service', 'event');
create type inspection_escalation_status as enum ('open', 'sent', 'resolved', 'dismissed');

create table inspection_escalations (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references accounts(id) on delete cascade,
  -- Polymorphic ref: exactly one of these two is set, never both.
  response_id   uuid references inspection_responses(id)   on delete cascade,
  intent_run_id uuid references inspection_intent_runs(id) on delete cascade,
  machine_id    uuid references machines(id) on delete set null,
  kind          inspection_escalation_kind   not null,
  status        inspection_escalation_status not null default 'open',
  notes         text,
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz,
  check ((response_id is not null) <> (intent_run_id is not null))
);
create index inspection_escalations_account_idx
  on inspection_escalations (account_id, created_at desc);
create index inspection_escalations_response_idx on inspection_escalations (response_id);
create index inspection_escalations_intent_idx   on inspection_escalations (intent_run_id);
create index inspection_escalations_machine_idx  on inspection_escalations (machine_id);

alter table inspection_escalations enable row level security;

create policy inspection_escalations_all on inspection_escalations for all
  using (is_member_of(account_id))
  with check (is_member_of(account_id));
