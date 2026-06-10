import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from './supabase/server';
import type { Site, SiteSource } from './types';
import type { TrackunitSite } from './trackunit-api';

interface SiteRow {
  id: string;
  account_id: string;
  fleet_id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  source: SiteSource | null;
  source_external_id: string | null;
}

function rowToSite(r: SiteRow): Site {
  return {
    id: r.id,
    accountId: r.account_id,
    fleetId: r.fleet_id,
    name: r.name,
    address: r.address,
    latitude: r.latitude,
    longitude: r.longitude,
    createdAt: r.created_at,
    // Default to 'manual' so rows that pre-date migration 0003 still parse
    // (the column is NOT NULL with a 'manual' default, so this is just paranoia).
    source: r.source ?? 'manual',
    sourceExternalId: r.source_external_id,
  };
}

/**
 * Look up a Trackunit-imported site by Trackunit's site id. Used by the cron
 * to translate `asset.trackunitSite.id` → our local `sites.id` when linking
 * machines.
 */
export async function getSiteByTrackunitId(
  accountId: string,
  trackunitSiteId: string
): Promise<Site | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('sites')
    .select('*')
    .eq('account_id', accountId)
    .eq('source', 'trackunit')
    .eq('source_external_id', trackunitSiteId)
    .maybeSingle();
  if (error) throw new Error(`Failed to look up Trackunit site: ${error.message}`);
  return data ? rowToSite(data as SiteRow) : null;
}

export async function listSitesForFleet(
  accountId: string,
  fleetId: string,
  allowedFleetIds: string[] | null = null
): Promise<Site[]> {
  if (allowedFleetIds !== null && !allowedFleetIds.includes(fleetId)) return [];
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('sites')
    .select('*')
    .eq('account_id', accountId)
    .eq('fleet_id', fleetId)
    .order('name', { ascending: true });
  if (error) throw new Error(`Failed to list sites: ${error.message}`);
  return (data ?? []).map((r) => rowToSite(r as SiteRow));
}

export async function listSitesForAccount(
  accountId: string,
  allowedFleetIds: string[] | null = null
): Promise<Site[]> {
  const supabase = createSupabaseServerClient();
  let q = supabase
    .from('sites')
    .select('*')
    .eq('account_id', accountId)
    .order('name', { ascending: true });
  if (allowedFleetIds !== null) {
    if (allowedFleetIds.length === 0) return [];
    q = q.in('fleet_id', allowedFleetIds);
  }
  const { data, error } = await q;
  if (error) throw new Error(`Failed to list sites: ${error.message}`);
  return (data ?? []).map((r) => rowToSite(r as SiteRow));
}

export async function getSite(siteId: string, accountId: string): Promise<Site | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('sites')
    .select('*')
    .eq('id', siteId)
    .eq('account_id', accountId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load site: ${error.message}`);
  return data ? rowToSite(data as SiteRow) : null;
}

export interface CreateSiteInput {
  fleetId: string;
  name: string;
  address?: string | null;
}

export async function createSite(
  accountId: string,
  userId: string,
  input: CreateSiteInput
): Promise<Site> {
  const name = input.name.trim();
  if (!name) throw new Error('Site name is required');
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('sites')
    .insert({
      account_id: accountId,
      fleet_id: input.fleetId,
      name,
      address: input.address ?? null,
      created_by: userId,
    })
    .select('*')
    .single();
  if (error || !data) throw new Error(`Failed to create site: ${error?.message}`);
  return rowToSite(data as SiteRow);
}

export interface UpdateSiteInput {
  name?: string;
  address?: string | null;
}

export async function updateSite(
  siteId: string,
  accountId: string,
  input: UpdateSiteInput
): Promise<Site> {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (!trimmed) throw new Error('Site name is required');
    patch.name = trimmed;
  }
  if (input.address !== undefined) patch.address = input.address;

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('sites')
    .update(patch)
    .eq('id', siteId)
    .eq('account_id', accountId)
    .select('*')
    .single();
  if (error || !data) throw new Error(`Failed to update site: ${error?.message}`);
  return rowToSite(data as SiteRow);
}

/**
 * Build the human-readable `address` field we store in our local `sites` row
 * by joining whatever Trackunit gave us back. Empty → null.
 */
function joinTrackunitAddress(t: TrackunitSite): string | null {
  const parts = [t.streetAddress, t.zipCode, t.city, t.country].filter(
    (p): p is string => typeof p === 'string' && p.trim().length > 0
  );
  return parts.length ? parts.join(', ') : null;
}

export interface UpsertSitesResult {
  inserted: number;
  updated: number;
  skipped: number;
}

/**
 * Upsert every Trackunit site under one account. Idempotent via the
 * partial unique index `(account_id, source_external_id) where source = 'trackunit'`.
 *
 * Caller supplies:
 *   - `defaultFleetId`: required NOT-NULL FK on the sites table. New rows
 *     land here; existing rows keep whatever fleet the user already moved
 *     them into.
 *
 * Accepts an admin (service-role) Supabase client because cron bypasses RLS.
 * Pass the result of `createSupabaseAdminClient()`.
 */
export async function upsertTrackunitSitesAsAdmin(
  admin: SupabaseClient,
  accountId: string,
  defaultFleetId: string,
  sites: TrackunitSite[]
): Promise<UpsertSitesResult> {
  const result: UpsertSitesResult = { inserted: 0, updated: 0, skipped: 0 };
  if (sites.length === 0) return result;

  // Pull existing Trackunit-sourced rows in ONE query so we can split
  // insert vs. update locally — avoids N round-trips on first run.
  const ids = sites.map((s) => s.id);
  const { data: existingRows, error: existingErr } = await admin
    .from('sites')
    .select('id, source_external_id, fleet_id, name, address')
    .eq('account_id', accountId)
    .eq('source', 'trackunit')
    .in('source_external_id', ids);
  if (existingErr) {
    throw new Error(`Failed to read existing Trackunit sites: ${existingErr.message}`);
  }
  const existingByExtId = new Map<string, { id: string; name: string; address: string | null }>();
  for (const r of (existingRows ?? []) as Array<{
    id: string;
    source_external_id: string;
    name: string;
    address: string | null;
  }>) {
    existingByExtId.set(r.source_external_id, { id: r.id, name: r.name, address: r.address });
  }

  const toInsert: Array<Record<string, unknown>> = [];
  const toUpdate: Array<{ id: string; patch: Record<string, unknown> }> = [];

  for (const ts of sites) {
    const address = joinTrackunitAddress(ts);
    const existing = existingByExtId.get(ts.id);
    if (!existing) {
      toInsert.push({
        account_id: accountId,
        fleet_id: defaultFleetId,
        name: ts.name,
        address,
        source: 'trackunit',
        source_external_id: ts.id,
      });
    } else if (existing.name !== ts.name || existing.address !== address) {
      // Only update fields Trackunit owns (name + address). Don't touch
      // fleet_id — users may have moved the site between fleets locally.
      toUpdate.push({ id: existing.id, patch: { name: ts.name, address } });
    } else {
      result.skipped++;
    }
  }

  if (toInsert.length > 0) {
    const { error: insertErr } = await admin.from('sites').insert(toInsert);
    if (insertErr) throw new Error(`Failed to insert Trackunit sites: ${insertErr.message}`);
    result.inserted = toInsert.length;
  }

  // Updates are issued one-at-a-time — Postgres can't bulk-patch with
  // distinct values per row without a VALUES join, and at site-count scale
  // (tens to low hundreds) sequential UPDATEs are fine.
  for (const u of toUpdate) {
    const { error: updateErr } = await admin
      .from('sites')
      .update(u.patch)
      .eq('id', u.id)
      .eq('account_id', accountId);
    if (updateErr) {
      // Log + skip rather than abort the whole sync.
      console.error(`[sync-sites] update failed for ${u.id}:`, updateErr.message);
      continue;
    }
    result.updated++;
  }

  return result;
}

/**
 * Build a Map<trackunitSiteId, localSiteId> for the given account's
 * Trackunit-sourced sites. Used by cron's fleet walk to translate
 * `asset.trackunitSite.id` → `machines.site_id` in O(1).
 */
export async function buildTrackunitSiteLookupAsAdmin(
  admin: SupabaseClient,
  accountId: string
): Promise<Map<string, string>> {
  const { data, error } = await admin
    .from('sites')
    .select('id, source_external_id')
    .eq('account_id', accountId)
    .eq('source', 'trackunit');
  if (error) {
    throw new Error(`Failed to load Trackunit site lookup: ${error.message}`);
  }
  const lookup = new Map<string, string>();
  for (const r of (data ?? []) as Array<{ id: string; source_external_id: string | null }>) {
    if (r.source_external_id) lookup.set(r.source_external_id, r.id);
  }
  return lookup;
}

export async function deleteSite(siteId: string, accountId: string): Promise<void> {
  const supabase = createSupabaseServerClient();
  // Clear site_id on any machines currently referencing this site so we don't
  // leave orphan FKs. (FK is on delete set null but this is more explicit.)
  await supabase
    .from('machines')
    .update({ site_id: null })
    .eq('account_id', accountId)
    .eq('site_id', siteId);

  const { error } = await supabase
    .from('sites')
    .delete()
    .eq('id', siteId)
    .eq('account_id', accountId);
  if (error) throw new Error(`Failed to delete site: ${error.message}`);
}
