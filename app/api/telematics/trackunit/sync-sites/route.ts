import { NextResponse, type NextRequest } from 'next/server';
import { getSessionContext } from '@/lib/getSessionContext';
import { getActiveTrackunitClient } from '@/lib/telematics/get-client';
import { fetchAllSitesGqlWith } from '@/lib/trackunit-api';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import {
  buildTrackunitSiteLookupAsAdmin,
  upsertTrackunitSitesAsAdmin,
} from '@/lib/sites';
import { getDefaultFleetIdAsAdmin } from '@/lib/fleets';

/**
 * Sync the active account's Trackunit sites into our `sites` table and
 * re-link every Trackunit-sourced machine's `site_id` to match Trackunit's
 * current assignment.
 *
 * This is the same work the background cron does after a successful
 * GraphQL fleet walk, exposed standalone so an admin can force a sites-only
 * refresh without triggering a full fleet snapshot rebuild.
 *
 * Auth: logged-in session — RLS protects against cross-account writes since
 * we resolve `accountId` from the session, then use the admin client for the
 * actual writes (sites + machines need to be reachable independent of RLS
 * because the FK to `fleets.id` can land outside the user's visible row set
 * on edge cases).
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(_req: NextRequest) {
  const ctx = await getSessionContext();
  const client = await getActiveTrackunitClient(ctx.accountId);
  if (!client) {
    return NextResponse.json({ error: 'No active Trackunit connection' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const start = Date.now();

  // 1. Default fleet — required NOT NULL on `sites.fleet_id`.
  const defaultFleetId = await getDefaultFleetIdAsAdmin(ctx.accountId);
  if (!defaultFleetId) {
    return NextResponse.json(
      { error: 'Account has no fleets — cannot sync sites.' },
      { status: 500 }
    );
  }

  // 2. Pull Trackunit's site list.
  let tuSites;
  try {
    tuSites = await fetchAllSitesGqlWith(client.provider);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Sites fetch failed';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
  if (!tuSites) {
    return NextResponse.json(
      { error: 'Trackunit returned no sites response — token may lack site.view.' },
      { status: 502 }
    );
  }

  // 3. Upsert into our table.
  const upsert = await upsertTrackunitSitesAsAdmin(
    admin,
    ctx.accountId,
    defaultFleetId,
    tuSites
  );

  // 4. Re-link machines whose snapshot already carries a `trackunitSite.id`.
  const lookup = await buildTrackunitSiteLookupAsAdmin(admin, ctx.accountId);
  const { data: machines, error: machinesErr } = await admin
    .from('machines')
    .select('id, last_snapshot, site_id')
    .eq('account_id', ctx.accountId)
    .eq('source', 'trackunit')
    .eq('status', 'active');
  if (machinesErr) {
    return NextResponse.json({ error: machinesErr.message }, { status: 500 });
  }

  let linked = 0;
  for (const row of (machines ?? []) as Array<{
    id: string;
    last_snapshot: { trackunitSite?: { id: string } | null } | null;
    site_id: string | null;
  }>) {
    const tuId = row.last_snapshot?.trackunitSite?.id ?? null;
    if (!tuId) continue;
    const localSiteId = lookup.get(tuId);
    if (!localSiteId || localSiteId === row.site_id) continue;
    const { error: updErr } = await admin
      .from('machines')
      .update({ site_id: localSiteId })
      .eq('id', row.id)
      .eq('account_id', ctx.accountId);
    if (updErr) {
      console.error(`[sync-sites] machine update failed for ${row.id}:`, updErr.message);
      continue;
    }
    linked++;
  }

  return NextResponse.json({
    fetched: tuSites.length,
    inserted: upsert.inserted,
    updated: upsert.updated,
    skipped: upsert.skipped,
    machinesLinked: linked,
    durationMs: Date.now() - start,
  });
}
