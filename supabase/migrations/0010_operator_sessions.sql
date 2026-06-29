-- Iteration 10: operator check-in sessions (the mobile "Operator" app).
-- A personal log: each row is one completed check-in (machine + start/end),
-- owned by the operator (auth user) who checked in. Scoped per-user (not
-- per-account) so the Log only ever shows the signed-in operator's own work.

create table operator_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  machine_id    text not null,
  machine_name  text not null,
  machine_brand text,
  machine_model text,
  machine_type  text,
  started_at    timestamptz not null,
  ended_at      timestamptz not null,
  created_at    timestamptz not null default now()
);
create index operator_sessions_user_idx on operator_sessions (user_id, started_at desc);

alter table operator_sessions enable row level security;

-- Operators only ever see / create their own sessions.
create policy operator_sessions_select on operator_sessions for select
  to authenticated using (auth.uid() = user_id);
create policy operator_sessions_insert on operator_sessions for insert
  to authenticated with check (auth.uid() = user_id);
