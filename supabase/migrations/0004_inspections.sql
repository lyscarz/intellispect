-- Iteration 4: inspection templates (form-based + intent-driven).
-- One table for both kinds (discriminator column). Form templates store their
-- section/question tree as JSONB; intent templates store a YAML body + chat
-- history with the AI authoring assistant.

create type inspection_kind   as enum ('form', 'intent');
create type inspection_status as enum ('draft', 'active');

create table inspection_templates (
  id           uuid primary key default gen_random_uuid(),
  account_id   uuid not null references accounts(id) on delete cascade,
  kind         inspection_kind   not null,
  status       inspection_status not null default 'draft',
  name         text not null,
  handle       text not null,             -- e.g. "preshift" → /preshift
  description  text,

  -- form kind only: { sections: [{ id, name, questions: [...] }] }
  form_schema  jsonb,

  -- intent kind only
  yaml_body    text,
  chat_history jsonb not null default '[]'::jsonb,  -- [{ role, content, ts }]

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references auth.users(id),

  unique (account_id, handle),
  check (
    (kind = 'form'   and form_schema is not null) or
    (kind = 'intent' and yaml_body  is not null)
  )
);
create index inspection_templates_account_idx on inspection_templates (account_id);
create index inspection_templates_kind_idx    on inspection_templates (account_id, kind);

alter table inspection_templates enable row level security;

create policy inspection_templates_all on inspection_templates for all
  using (is_member_of(account_id))
  with check (is_member_of(account_id));

-- Bump updated_at on every UPDATE.
create or replace function set_updated_at() returns trigger
  language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger inspection_templates_set_updated_at
  before update on inspection_templates
  for each row execute function set_updated_at();
