-- Iteration 6: completed inspection runs (mobile submit destination).
-- Two tables:
--   inspection_responses        — one row per submitted inspection
--   inspection_response_photos  — photo attachments (answer photos + comment photos)
-- Photos themselves live in Supabase Storage bucket 'inspection-photos' under
-- path {accountId}/{responseId}/{uuid}.{ext}.

create table inspection_responses (
  id                       uuid primary key default gen_random_uuid(),
  account_id               uuid not null references accounts(id) on delete cascade,
  template_id              uuid not null references inspection_templates(id) on delete restrict,
  -- Frozen copy of form_schema at submit time. Template edits/deletes can't
  -- retroactively break historical responses.
  template_snapshot        jsonb not null,
  -- machine/site are intentionally ON DELETE SET NULL: when a machine is
  -- removed we keep the response (audit trail) but drop the dangling FK.
  machine_id               uuid references machines(id) on delete set null,
  site_id                  uuid references sites(id)    on delete set null,
  submitted_by             uuid references auth.users(id),
  submitted_at             timestamptz not null default now(),
  -- For symmetry with intent runs (started_at / completed_at). Form runs are
  -- single-shot so these default to now() and are typically equal.
  started_at               timestamptz not null default now(),
  completed_at             timestamptz,
  -- { [questionId]: { type: 'yes_no', value: 'yes' } | ... }
  answers                  jsonb not null default '{}'::jsonb,
  -- { [questionId]: { text?: string } } — photo refs live in the photos table
  comments                 jsonb not null default '{}'::jsonb,
  -- 'complete' on submit; 'partial' / 'in_progress' are reserved for future use.
  status                   text  not null default 'complete',
  -- Best-effort AI summary written via UPDATE after insert. Nullable on failure.
  summary                  text,
  -- Pre-flight verdict snapshot (PreflightVerdict shape from lib/inspections/types.ts).
  preflight                jsonb,
  -- Telematics captured at run start (so we can compute deltas later).
  engine_hours_at_start    numeric,
  operating_hours_at_start numeric,
  machine_state_at_start   jsonb
);
create index inspection_responses_account_idx
  on inspection_responses (account_id, submitted_at desc);
create index inspection_responses_template_idx on inspection_responses (template_id);
create index inspection_responses_machine_idx  on inspection_responses (machine_id);
create index inspection_responses_site_idx     on inspection_responses (site_id);

create table inspection_response_photos (
  id           uuid primary key default gen_random_uuid(),
  response_id  uuid not null references inspection_responses(id) on delete cascade,
  account_id   uuid not null references accounts(id) on delete cascade,
  question_id  text not null,
  -- Populated for photo_set answers; null for comment photos.
  slot_id      text,
  kind         text not null check (kind in ('answer', 'comment')),
  storage_path text not null,             -- bucket-relative path
  content_type text,
  size_bytes   integer,
  created_at   timestamptz not null default now()
);
create index inspection_response_photos_response_idx
  on inspection_response_photos (response_id);
create index inspection_response_photos_account_idx
  on inspection_response_photos (account_id);

alter table inspection_responses       enable row level security;
alter table inspection_response_photos enable row level security;

create policy inspection_responses_all on inspection_responses for all
  using (is_member_of(account_id))
  with check (is_member_of(account_id));

create policy inspection_response_photos_all on inspection_response_photos for all
  using (is_member_of(account_id))
  with check (is_member_of(account_id));

-- ─── Storage bucket for inspection photos ────────────────────────────────────
-- Run after this migration (one-time, in SQL editor) — matches the pattern
-- used for the 'machine-images' bucket in 0001:
--
--   insert into storage.buckets (id, name, public)
--     values ('inspection-photos', 'inspection-photos', false);
--
--   create policy "inspection-photos read"   on storage.objects for select
--     using (bucket_id = 'inspection-photos' and is_member_of((storage.foldername(name))[1]::uuid));
--   create policy "inspection-photos insert" on storage.objects for insert
--     with check (bucket_id = 'inspection-photos' and is_member_of((storage.foldername(name))[1]::uuid));
--   create policy "inspection-photos delete" on storage.objects for delete
--     using (bucket_id = 'inspection-photos' and is_member_of((storage.foldername(name))[1]::uuid));
