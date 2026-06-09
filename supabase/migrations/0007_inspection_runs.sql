-- Iteration 7: pre-inspection AI analysis + persisted runs.
-- Form runs already persist into inspection_responses (0006). This migration:
--   - extends inspection_responses with the run-level columns:
--       started_at, completed_at, preflight, hours snapshot, summary, findings
--   - creates inspection_intent_runs (sibling table for intent inspections)
--
-- The resolver lib/inspections/runs.ts UNIONs the two tables to find
-- "last completed run for (machine_id, template_id)".

alter table inspection_responses
  add column if not exists started_at               timestamptz not null default now(),
  add column if not exists completed_at             timestamptz,
  add column if not exists preflight                jsonb,
  add column if not exists engine_hours_at_start    numeric,
  add column if not exists operating_hours_at_start numeric,
  add column if not exists machine_state_at_start   jsonb,
  add column if not exists summary                  text,
  add column if not exists findings                 jsonb;

-- Hot path: "last run of this template on this machine".
create index if not exists inspection_responses_machine_template_idx
  on inspection_responses (machine_id, template_id, completed_at desc);

-- ─── Intent runs ────────────────────────────────────────────────────────────
create table inspection_intent_runs (
  id                       uuid primary key default gen_random_uuid(),
  account_id               uuid not null references accounts(id) on delete cascade,
  template_id              uuid not null references inspection_templates(id) on delete restrict,
  machine_id               uuid references machines(id) on delete set null,
  operator_id              uuid references auth.users(id),
  status                   text not null default 'in_progress',  -- in_progress | complete | partial | skipped

  started_at               timestamptz not null default now(),
  completed_at             timestamptz,

  -- Frozen YAML at run start so historical runs survive template edits.
  yaml_snapshot            text not null,
  transcript               jsonb not null default '[]'::jsonb,

  preflight                jsonb,
  engine_hours_at_start    numeric,
  operating_hours_at_start numeric,
  machine_state_at_start   jsonb,
  summary                  text,
  findings                 jsonb
);
create index inspection_intent_runs_account_idx
  on inspection_intent_runs (account_id, started_at desc);
create index inspection_intent_runs_machine_template_idx
  on inspection_intent_runs (machine_id, template_id, completed_at desc);
create index inspection_intent_runs_operator_idx
  on inspection_intent_runs (operator_id);

alter table inspection_intent_runs enable row level security;

create policy inspection_intent_runs_all on inspection_intent_runs for all
  using (is_member_of(account_id))
  with check (is_member_of(account_id));
