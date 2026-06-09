import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  listAccountsWithActiveTrackunit,
  loadDecryptedCredsAsAdmin,
} from '@/lib/telematics/connections';
import {
  applyAempToAsset,
  fetchAempMap,
  fetchAllAssetsGqlWith,
  fetchAllSitesGqlWith,
  normalizeSerial,
} from '@/lib/trackunit-api';
import { createTrackunitTokenProvider } from '@/lib/trackunit-auth';
import { mergeAssetSnapshot } from '@/lib/machines';
import {
  buildTrackunitSiteLookupAsAdmin,
  upsertTrackunitSitesAsAdmin,
} from '@/lib/sites';
import { getDefaultFleetIdAsAdmin } from '@/lib/fleets';
import type { Asset } from '@/lib/types';

export const dynamic = 'force-dynamic';
// Long-lived task: Vercel Pro allows up to 5 minutes. Free is 60s — large
// fleets may not finish under free tier.
export const maxDuration = 300;

interface AccountResult {
  accountId: string;
  path: 'gql' | 'aemp' | 'none';
  fetched: number;
  updated: number;
  skipped: number;
  error?: string;
  gqlError?: string;
  // Iter 6: site-sync stats. Only populated when the GraphQL fleet walk
  // succeeded — the AEMP path can't see sites.
  sitesFetched?: number;
  sitesInserted?: number;
  sitesUpdated?: number;
  sitesLinked?: number;
  sitesError?: string;
}

async function refreshAccount(accountId: string): Promise<AccountResult> {
  const result: AccountResult = { accountId, path: 'none', fetched: 0, updated: 0, skipped: 0 };
  try {
    const loaded = await loadDecryptedCredsAsAdmin(accountId, 'trackunit');
    if (!loaded) {
      result.error = 'No active Trackunit connection';
      return result;
    }
    const provider = createTrackunitTokenProvider(loaded.creds);
    const admin = createSupabaseAdminClient();
    const now = new Date().toISOString();

    // List local machines once.
    const { data: machines, error: listErr } = await admin
      .from('machines')
      .select('id, source_external_id, serial_number, last_snapshot')
      .eq('account_id', accountId)
      .eq('source', 'trackunit')
      .eq('status', 'active');
    if (listErr) {
      result.error = listErr.message;
      return result;
    }
    const rows = (machines ?? []) as Array<{
      id: string;
      source_external_id: string | null;
      serial_number: string | null;
      last_snapshot: Asset | null;
    }>;

    // Path 1: GraphQL fleet feed — preferred when IrisX is enabled. One
    // paginated walk returns all assets with location + image + insights.
    let gqlAssets: Asset[] | null = null;
    try {
      gqlAssets = await fetchAllAssetsGqlWith(provider);
    } catch (err) {
      // Capture for visibility — the response will tell us why we fell back.
      result.gqlError = err instanceof Error ? err.message : String(err);
      gqlAssets = null;
    }

    if (gqlAssets && gqlAssets.length > 0) {
      result.path = 'gql';
      result.fetched = gqlAssets.length;

      // Sync sites BEFORE the machine UPDATE loop so the lookup is current.
      // Failure here is non-fatal — we still write the asset snapshots, just
      // without linking site_id. We surface the error via result.sitesError.
      let trackunitSiteLookup = new Map<string, string>();
      try {
        const defaultFleetId = await getDefaultFleetIdAsAdmin(accountId);
        if (!defaultFleetId) {
          result.sitesError = 'No fleets exist for this account (0002 backfill missing?)';
        } else {
          const tuSites = await fetchAllSitesGqlWith(provider);
          if (tuSites) {
            result.sitesFetched = tuSites.length;
            const upsertResult = await upsertTrackunitSitesAsAdmin(
              admin,
              accountId,
              defaultFleetId,
              tuSites
            );
            result.sitesInserted = upsertResult.inserted;
            result.sitesUpdated = upsertResult.updated;
          }
        }
        trackunitSiteLookup = await buildTrackunitSiteLookupAsAdmin(admin, accountId);
      } catch (err) {
        result.sitesError = err instanceof Error ? err.message : String(err);
        // Keep going — we still want to write fresh snapshots even if sites broke.
      }

      const byId = new Map(gqlAssets.map((a) => [a.assetId, a]));
      let sitesLinked = 0;
      for (const row of rows) {
        if (!row.source_external_id) {
          result.skipped++;
          continue;
        }
        const fresh = byId.get(row.source_external_id);
        if (!fresh) {
          result.skipped++;
          continue;
        }
        const merged = mergeAssetSnapshot(row.last_snapshot, fresh);
        // Resolve Trackunit's site id → our local site id, if we have one.
        // null means "Trackunit says no site" (or we couldn't sync) — leave
        // site_id alone in that case so we don't clear a user's manual
        // assignment on every cron tick.
        const localSiteId = fresh.trackunitSite?.id
          ? trackunitSiteLookup.get(fresh.trackunitSite.id) ?? null
          : null;
        const patch: Record<string, unknown> = {
          last_snapshot: merged,
          last_synced_at: now,
        };
        if (localSiteId) {
          patch.site_id = localSiteId;
        }
        const { error } = await admin
          .from('machines')
          .update(patch)
          .eq('id', row.id)
          .eq('account_id', accountId);
        if (error) {
          console.error(`[cron] update failed for ${row.id}:`, error.message);
          continue;
        }
        if (localSiteId) sitesLinked++;
        result.updated++;
      }
      result.sitesLinked = sitesLinked;
      return result;
    }

    // Path 2: V1 REST + AEMP. Walk AEMP once, join by serial, apply.
    const aempMap = await fetchAempMap(provider);
    result.path = 'aemp';
    result.fetched = aempMap.size;
    if (aempMap.size === 0) {
      result.error = 'AEMP returned no equipment';
      return result;
    }

    for (const row of rows) {
      const key = normalizeSerial(row.serial_number);
      const aemp = key ? aempMap.get(key) : undefined;
      if (!row.last_snapshot || !aemp) {
        result.skipped++;
        continue;
      }
      const fresh = applyAempToAsset(row.last_snapshot, aemp);
      if (fresh === row.last_snapshot) {
        result.skipped++;
        continue;
      }
      const { error } = await admin
        .from('machines')
        .update({ last_snapshot: fresh, last_synced_at: now })
        .eq('id', row.id)
        .eq('account_id', accountId);
      if (error) {
        console.error(`[cron] update failed for ${row.id}:`, error.message);
        continue;
      }
      result.updated++;
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
  }
  return result;
}

async function isAuthorized(request: NextRequest): Promise<{ ok: boolean; scopedAccountId?: string }> {
  // Vercel Cron path: header bearer matches CRON_SECRET.
  const auth = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && auth === `Bearer ${cronSecret}`) {
    return { ok: true };
  }

  // Admin path: a logged-in user is calling /api/cron/refresh-aemp manually.
  // Scope the refresh to that user's CURRENTLY-ACTIVE account (from the
  // `active_account_id` cookie set by getSessionContext) — not the arbitrary
  // first membership. Otherwise the cron may target a different account than
  // the one the user is viewing in the UI.
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const admin = createSupabaseAdminClient();
  const cookieStore = cookies();
  const activeAccountId = cookieStore.get('active_account_id')?.value;

  if (activeAccountId) {
    const { data: cookieMembership } = await admin
      .from('account_members')
      .select('account_id')
      .eq('user_id', user.id)
      .eq('account_id', activeAccountId)
      .maybeSingle();
    if (cookieMembership) {
      return { ok: true, scopedAccountId: activeAccountId };
    }
  }

  // Fall back to first membership if the cookie is missing or stale.
  const { data: membership } = await admin
    .from('account_members')
    .select('account_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) return { ok: false };
  return { ok: true, scopedAccountId: membership.account_id as string };
}

async function handle(request: NextRequest) {
  const start = Date.now();
  const auth = await isAuthorized(request);
  if (!auth.ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const accountIds = auth.scopedAccountId
    ? [auth.scopedAccountId]
    : await listAccountsWithActiveTrackunit();

  const results: AccountResult[] = [];
  for (const accountId of accountIds) {
    results.push(await refreshAccount(accountId));
  }

  const totals = results.reduce(
    (acc, r) => ({
      updated: acc.updated + r.updated,
      skipped: acc.skipped + r.skipped,
      fetched: acc.fetched + r.fetched,
      errors: acc.errors + (r.error ? 1 : 0),
    }),
    { updated: 0, skipped: 0, fetched: 0, errors: 0 }
  );

  return NextResponse.json({
    accounts: results.length,
    durationMs: Date.now() - start,
    ...totals,
    results,
  });
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
