import { NextResponse, type NextRequest } from 'next/server';
import { getSessionContext } from '@/lib/getSessionContext';
import { getActiveTrackunitClient } from '@/lib/telematics/get-client';
import { fetchAssetForImportWith } from '@/lib/trackunit-api';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Asset } from '@/lib/types';

const IMPORT_MAX = 500;
const IMPORT_CONCURRENCY = 4;

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext();
  const body = await request.json();
  const assetIds = Array.isArray(body?.assetIds)
    ? (body.assetIds as unknown[]).filter((v): v is string => typeof v === 'string')
    : [];
  const targetFleetId: string | null =
    typeof body?.fleetId === 'string' && body.fleetId.length > 0 ? body.fleetId : null;
  const targetSiteId: string | null =
    typeof body?.siteId === 'string' && body.siteId.length > 0 ? body.siteId : null;

  if (assetIds.length === 0) {
    return NextResponse.json({ error: 'assetIds is required' }, { status: 400 });
  }
  if (assetIds.length > IMPORT_MAX) {
    return NextResponse.json(
      {
        error: `Too many machines in one import (${assetIds.length}). Maximum is ${IMPORT_MAX} per request — split into batches.`,
      },
      { status: 400 }
    );
  }

  const client = await getActiveTrackunitClient(ctx.accountId);
  if (!client) {
    return NextResponse.json({ error: 'No active Trackunit connection' }, { status: 400 });
  }

  // Validate target fleet/site belong to this account, and site belongs to the chosen fleet.
  if (targetFleetId || targetSiteId) {
    const supabaseCheck = createSupabaseServerClient();
    if (targetFleetId) {
      const { data: fleet } = await supabaseCheck
        .from('fleets')
        .select('id')
        .eq('id', targetFleetId)
        .eq('account_id', ctx.accountId)
        .maybeSingle();
      if (!fleet) {
        return NextResponse.json({ error: 'Target fleet not found' }, { status: 400 });
      }
    }
    if (targetSiteId) {
      const { data: site } = await supabaseCheck
        .from('sites')
        .select('id, fleet_id')
        .eq('id', targetSiteId)
        .eq('account_id', ctx.accountId)
        .maybeSingle();
      if (!site) {
        return NextResponse.json({ error: 'Target site not found' }, { status: 400 });
      }
      if (site.fleet_id !== targetFleetId) {
        return NextResponse.json(
          { error: "Target site doesn't belong to the target fleet" },
          { status: 400 }
        );
      }
    }
  }

  // Per-asset metadata fetch (no AEMP walk). One Asset-API request per ID,
  // capped at IMPORT_CONCURRENCY in parallel. Location/fuel/hours land on the
  // next cron tick or first home-page visit.
  const assets: Array<Asset | null> = new Array(assetIds.length).fill(null);
  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < assetIds.length) {
      const idx = cursor++;
      assets[idx] = await fetchAssetForImportWith(client!.provider, assetIds[idx]);
    }
  }
  try {
    await Promise.all(
      Array.from({ length: Math.min(IMPORT_CONCURRENCY, assetIds.length) }, () => worker())
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch asset metadata';
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const supabase = createSupabaseServerClient();
  const now = new Date().toISOString();

  const rows = assets
    .filter((a): a is Asset => !!a)
    .map((a) => ({
      account_id: ctx.accountId,
      source: 'trackunit' as const,
      source_external_id: a.assetId,
      source_connection_id: client.connectionId,
      status: 'active' as const,
      name: a.name,
      brand: a.brand,
      model: a.model,
      serial_number: a.serialNumber,
      site: null,
      fleet_id: targetFleetId,
      site_id: targetSiteId,
      // Snapshot has metadata only; location/fuel/hours come from next cron.
      last_snapshot: a,
      last_synced_at: now,
      created_by: ctx.userId,
    }));

  if (rows.length === 0) {
    return NextResponse.json({ inserted: 0, requested: assetIds.length, notFound: assetIds.length });
  }

  const { data, error } = await supabase
    .from('machines')
    .upsert(rows, { onConflict: 'account_id,source,source_external_id', ignoreDuplicates: true })
    .select('id');
  if (error) {
    return NextResponse.json({ error: `Failed to import: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({
    inserted: data?.length ?? 0,
    skipped: rows.length - (data?.length ?? 0),
    requested: assetIds.length,
    notFound: assetIds.length - rows.length,
  });
}
