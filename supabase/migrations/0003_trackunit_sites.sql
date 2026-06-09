-- Iteration 6: Trackunit-imported sites.
-- Adds a discriminator (`source`) + a Trackunit-side identifier
-- (`source_external_id`) to the `sites` table so we can:
--   1. Show a "Trackunit" pill next to imported site rows in /sites
--   2. Idempotently upsert the same Trackunit site on every cron run
--   3. Link machines to imported sites by Trackunit's site id during the
--      GraphQL fleet walk in app/api/cron/refresh-aemp/route.ts

alter table sites
  add column source text not null default 'manual',
  add column source_external_id text;

-- One (account, trackunit_site_id) tuple at most — prevents the cron from
-- inserting the same Trackunit site twice into the same account. Partial
-- index so manual sites are unaffected (they have NULL source_external_id).
create unique index sites_account_trackunit_unique
  on sites (account_id, source_external_id)
  where source = 'trackunit';

-- Look-up index for the cron's machine-linking step: given an asset's
-- trackunit site id, find the local sites row.
create index sites_source_external_id_idx
  on sites (account_id, source, source_external_id)
  where source = 'trackunit';
