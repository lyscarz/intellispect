import { NextResponse, type NextRequest } from 'next/server';
import { getSessionContext } from '@/lib/getSessionContext';
import { getMachine, mergeAssetSnapshot } from '@/lib/machines';
import { getActiveTrackunitClient } from '@/lib/telematics/get-client';
import { fetchAssetWith } from '@/lib/trackunit-api';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Refresh a single Trackunit machine's snapshot.
 *
 * ─── CANONICAL PER-MACHINE REFRESH TRIGGER ──────────────────────────────────
 *
 * This is **the** endpoint every client should call to refresh a single
 * machine's live state. The web app uses it (MachineHomeLive on-mount +
 * Refresh-now button). Future clients — including the inspection client —
 * should call this same endpoint, with the same contract, rather than
 * spinning up parallel refresh paths.
 *
 *   POST /api/machines/:id/refresh
 *     - Body:    (empty)
 *     - Auth:    session cookie (RLS-scoped to the active account)
 *     - 200:     { ok: true, snapshot: Asset, syncedAt: string }
 *     - 404:     machine not found in this account
 *     - 400:     machine isn't a Trackunit-sourced one
 *     - 502:     no active Trackunit connection / fetch failed
 *
 * The returned `Asset` carries everything any client needs to render machine
 * state: image, location, telemetry insights, status (activity + criticality
 * + attention counts), the asset's Trackunit site, and the active events
 * list with type/severity/description/openedAt. No second endpoint to call.
 *
 * Strategy under the hood: `fetchAssetWith` prefers V2 GraphQL (1 request,
 * includes image + location + fuel + hours + activity + events for the
 * specific asset, no AEMP walk). Falls back to V1 REST + cached AEMP map if
 * V2 isn't configured (REST path doesn't return events — `events: []`).
 *
 * The fresh Asset is merged with the existing snapshot via
 * `mergeAssetSnapshot` so a transient miss doesn't blank previously-known
 * fields (location, events, attention, etc.).
 */
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getSessionContext();
  const machine = await getMachine(params.id, ctx.accountId);
  if (!machine) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (machine.source !== 'trackunit' || !machine.sourceExternalId) {
    return NextResponse.json({ error: 'Not a Trackunit machine' }, { status: 400 });
  }

  const client = await getActiveTrackunitClient(ctx.accountId);
  if (!client) {
    return NextResponse.json({ error: 'No active Trackunit connection' }, { status: 400 });
  }

  let fresh;
  try {
    fresh = await fetchAssetWith(client.provider, machine.sourceExternalId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Trackunit fetch failed';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
  if (!fresh) {
    return NextResponse.json({ error: 'Asset not found in Trackunit' }, { status: 404 });
  }

  const merged = mergeAssetSnapshot(machine.lastSnapshot, fresh);
  const syncedAt = new Date().toISOString();

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from('machines')
    .update({ last_snapshot: merged, last_synced_at: syncedAt })
    .eq('id', machine.id)
    .eq('account_id', ctx.accountId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, snapshot: merged, syncedAt });
}
