import { NextResponse, type NextRequest } from 'next/server';
import { getSessionContext } from '@/lib/getSessionContext';
import { getActiveTrackunitClient } from '@/lib/telematics/get-client';
import { applyAempToAsset, fetchAempMap, normalizeSerial } from '@/lib/trackunit-api';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Asset } from '@/lib/types';

/**
 * Sync every active Trackunit-sourced machine for the active account by
 * joining locally-stored machines against the AEMP fleet feed.
 *
 * Approach (mirrors what the PoC did successfully):
 *   1. Fetch the AEMP map ONCE (~8 paginated requests, cached for 2 min).
 *   2. Walk every machine row in our DB.
 *   3. Look up each machine in the AEMP map by its stored serial number.
 *   4. Overlay AEMP-derived telemetry (location, fuel, hours, engine status,
 *      lastSeen) on top of the existing snapshot via `applyAempToAsset`,
 *      then write back to DB.
 *
 * If AEMP returns no records (rate-limited or feed empty), the route errors
 * out — it never overwrites good data with null.
 */
export async function POST(_req: NextRequest) {
  const ctx = await getSessionContext();
  const client = await getActiveTrackunitClient(ctx.accountId);
  if (!client) {
    return NextResponse.json({ error: 'No active Trackunit connection' }, { status: 400 });
  }

  // 1. AEMP map — one shot.
  let aempMap;
  try {
    aempMap = await fetchAempMap(client.provider);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'AEMP fetch failed';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
  if (aempMap.size === 0) {
    return NextResponse.json(
      {
        error:
          'AEMP returned no equipment. The feed is rate-limited or temporarily empty — wait a few minutes and try again. No data was overwritten.',
      },
      { status: 502 }
    );
  }

  // 2. Local machine rows.
  const supabase = createSupabaseServerClient();
  const { data: machines, error: listErr } = await supabase
    .from('machines')
    .select('id, source_external_id, serial_number, last_snapshot')
    .eq('account_id', ctx.accountId)
    .eq('source', 'trackunit')
    .eq('status', 'active');
  if (listErr) {
    return NextResponse.json({ error: listErr.message }, { status: 500 });
  }
  const rows = (machines ?? []) as Array<{
    id: string;
    source_external_id: string | null;
    serial_number: string | null;
    last_snapshot: Asset | null;
  }>;

  // 3 + 4. Lookup + overlay + write.
  let updated = 0;
  let unchanged = 0;
  let notInAemp = 0;
  let failed = 0;

  for (const row of rows) {
    const key = normalizeSerial(row.serial_number);
    const aemp = key ? aempMap.get(key) : undefined;
    if (!aemp) {
      notInAemp++;
      continue;
    }
    if (!row.last_snapshot) {
      // No baseline snapshot to overlay onto — skip rather than synthesize a
      // partial one. (In practice imports always create a snapshot.)
      failed++;
      continue;
    }
    const fresh = applyAempToAsset(row.last_snapshot, aemp);
    // If applyAempToAsset returned the same object (no AEMP fields), don't write.
    if (fresh === row.last_snapshot) {
      unchanged++;
      continue;
    }
    const { error } = await supabase
      .from('machines')
      .update({ last_snapshot: fresh, last_synced_at: new Date().toISOString() })
      .eq('id', row.id)
      .eq('account_id', ctx.accountId);
    if (error) failed++;
    else updated++;
  }

  return NextResponse.json({
    updated,
    unchanged,
    notInAemp,
    failed,
    total: rows.length,
    aempEquipmentCount: aempMap.size,
  });
}
