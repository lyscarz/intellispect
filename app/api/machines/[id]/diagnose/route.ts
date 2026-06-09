import { NextResponse, type NextRequest } from 'next/server';
import { getSessionContext } from '@/lib/getSessionContext';
import { getMachine } from '@/lib/machines';
import { getActiveTrackunitClient } from '@/lib/telematics/get-client';

/**
 * Diagnostic for a single Trackunit machine. Probes a handful of candidate
 * Trackunit URLs with the account's V1 token and reports what each returns.
 * Use the output to identify which endpoint exposes last-known position for
 * assets that aren't in the AEMP fleet feed.
 *
 * Hit it with the dev console open at /fleet/[id]/diagnose-link or directly:
 *   POST /api/machines/{id}/diagnose
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function handle({ params }: { params: { id: string } }) {
  if (!UUID_RE.test(params.id)) {
    return NextResponse.json(
      {
        error: `Invalid machine id "${params.id}" — paste the UUID from the /fleet/[id] URL.`,
        hint: 'Open a machine home page (/fleet/<uuid>) and append /diagnose to the URL.',
      },
      { status: 400 }
    );
  }
  const ctx = await getSessionContext();
  const machine = await getMachine(params.id, ctx.accountId);
  if (!machine) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (machine.source !== 'trackunit' || !machine.sourceExternalId) {
    return NextResponse.json({ error: 'Not a Trackunit machine' }, { status: 400 });
  }

  const client = await getActiveTrackunitClient(ctx.accountId);
  if (!client) return NextResponse.json({ error: 'No active Trackunit connection' }, { status: 400 });

  const restToken = await client.provider.getRestToken();
  const gqlToken = await client.provider.getGqlToken();
  const id = machine.sourceExternalId;

  // First, get the asset metadata so we have the serial number to compare against AEMP.
  const assetMetaRes = await fetch(`https://iris.trackunit.com/api/asset/v2/assets/${id}`, {
    headers: { Authorization: `Bearer ${restToken}`, Accept: 'application/json' },
    cache: 'no-store',
  });
  const assetMetaText = await assetMetaRes.text();
  let assetMetaJson: unknown = null;
  try {
    assetMetaJson = JSON.parse(assetMetaText);
  } catch {}

  const serialNumber = (assetMetaJson as { serialNumber?: string } | null)?.serialNumber ?? null;

  // Candidate per-asset position endpoints. Probe each with the V1 REST token.
  const candidates = [
    `https://iris.trackunit.com/api/position/v2/positions/${id}`,
    `https://iris.trackunit.com/api/position/v2/positions?assetId=${id}`,
    `https://iris.trackunit.com/api/positions/v2/${id}`,
    `https://iris.trackunit.com/api/asset/v2/assets/${id}/position`,
    `https://iris.trackunit.com/api/asset/v2/assets/${id}/positions`,
    `https://iris.trackunit.com/api/asset/v2/assets/${id}/location`,
    `https://iris.trackunit.com/api/asset/v2/assets/${id}/locations`,
    `https://iris.trackunit.com/public/api/position/v2/positions/${id}`,
    `https://iris.trackunit.com/public/api/positions/v2/${id}`,
    `https://iris.trackunit.com/api/iris/assets/${id}/positions/latest`,
    `https://iris.trackunit.com/api/iris/positions/${id}/latest`,
  ];

  const probes = await Promise.all(
    candidates.map(async (url) => {
      try {
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${restToken}`, Accept: 'application/json' },
          cache: 'no-store',
        });
        const text = await res.text();
        return {
          url,
          status: res.status,
          contentType: res.headers.get('content-type'),
          // Only show first 400 chars to keep response small.
          bodyPreview: text.slice(0, 400),
        };
      } catch (err) {
        return { url, error: err instanceof Error ? err.message : String(err) };
      }
    })
  );

  // ── AEMP probe ──────────────────────────────────────────────────────────────
  // Replicate the production AEMP fetch but capture diagnostics: page count,
  // links shape, equipment count, sample serials, and lookup-strategy results
  // for THIS machine's serial number.
  const AEMP_BASE = 'https://iris.trackunit.com/public/api/aemp/v2/15143/-3/Fleet';

  type AempEqHeader = {
    EquipmentID?: string;
    SerialNumber?: string;
    PIN?: string;
    OEMName?: string;
    Model?: string;
  };
  type AempEq = {
    EquipmentHeader?: AempEqHeader;
    Location?: { Latitude?: number; Longitude?: number; datetime?: string };
    CumulativeOperatingHours?: { Hour?: number; datetime?: string };
    CumulativeIdleHours?: { Hour?: number; datetime?: string };
    FuelRemaining?: { Percent?: number; datetime?: string };
    EngineStatus?: { Running?: boolean; datetime?: string };
  };
  type AempPage = { equipment?: AempEq[]; links?: Array<{ href: string; rel: string }> };

  function normSerial(s: string | undefined | null): string | null {
    if (!s) return null;
    const t = s.trim().toUpperCase();
    return t.length ? t : null;
  }

  let aempDiagnostic: unknown = null;
  try {
    const visited: string[] = [];
    const seen = new Set<string>();
    let url: string | null = `${AEMP_BASE}/1`;
    const equipment: AempEq[] = [];
    let firstPageLinks: Array<{ href: string; rel: string }> | null = null;
    let lastLinkRaw: string | null = null;
    let lastLinkParsedNumber: number | null = null;
    let hops = 0;
    const MAX_HOPS = 50; // safety cap

    while (url && !seen.has(url) && hops < MAX_HOPS) {
      seen.add(url);
      visited.push(url);
      hops++;
      const pageRes = await fetch(url, {
        headers: { Authorization: `Bearer ${restToken}`, Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!pageRes.ok) break;
      const page = (await pageRes.json()) as AempPage;
      if (!firstPageLinks) {
        firstPageLinks = page.links ?? [];
        const ll = firstPageLinks.find((l) => l.rel === 'last');
        lastLinkRaw = ll?.href ?? null;
        if (lastLinkRaw) {
          lastLinkParsedNumber = parseInt(lastLinkRaw.split('/').pop() ?? '1', 10) || null;
        }
      }
      if (page.equipment) equipment.push(...page.equipment);
      url = page.links?.find((l) => l.rel === 'next')?.href ?? null;
    }

    // Build maps for lookup analysis.
    const byNormSerial = new Map<string, AempEq>();
    const byNormPin = new Map<string, AempEq>();
    const byNormEqId = new Map<string, AempEq>();
    for (const e of equipment) {
      const ns = normSerial(e.EquipmentHeader?.SerialNumber);
      const np = normSerial(e.EquipmentHeader?.PIN);
      const ne = normSerial(e.EquipmentHeader?.EquipmentID);
      if (ns && !byNormSerial.has(ns)) byNormSerial.set(ns, e);
      if (np && !byNormPin.has(np)) byNormPin.set(np, e);
      if (ne && !byNormEqId.has(ne)) byNormEqId.set(ne, e);
    }

    const target = serialNumber;
    const targetNorm = normSerial(target);

    type LookupResult = {
      match: string | null;
      via: string;
      sample?: AempEqHeader;
      location?: { lat?: number; lng?: number };
    };
    const lookupAttempts: LookupResult[] = [];

    function recordHit(via: string, eq: AempEq | undefined) {
      if (!eq) {
        lookupAttempts.push({ match: null, via });
        return;
      }
      lookupAttempts.push({
        match: 'hit',
        via,
        sample: eq.EquipmentHeader,
        location: { lat: eq.Location?.Latitude, lng: eq.Location?.Longitude },
      });
    }

    // Also test the asset's telematics device serial — AEMP records may be
    // keyed by device serial rather than asset serial.
    const deviceSerialRaw = (assetMetaJson as {
      telematicsDevices?: Array<{ serialNumber?: string; id?: string }>;
    } | null)?.telematicsDevices?.[0]?.serialNumber ?? null;
    const deviceIdRaw = (assetMetaJson as {
      telematicsDevices?: Array<{ serialNumber?: string; id?: string }>;
    } | null)?.telematicsDevices?.[0]?.id ?? null;
    const deviceSerialNorm = normSerial(deviceSerialRaw);
    const deviceIdNorm = normSerial(deviceIdRaw);

    if (targetNorm) {
      recordHit('asset-serial → SerialNumber', byNormSerial.get(targetNorm));
      recordHit('asset-serial → PIN', byNormPin.get(targetNorm));
      recordHit('asset-serial → EquipmentID', byNormEqId.get(targetNorm));
    }
    if (deviceSerialNorm) {
      recordHit('device-serial → SerialNumber', byNormSerial.get(deviceSerialNorm));
      recordHit('device-serial → PIN', byNormPin.get(deviceSerialNorm));
      recordHit('device-serial → EquipmentID', byNormEqId.get(deviceSerialNorm));
    }
    if (deviceIdNorm) {
      recordHit('device-id → SerialNumber', byNormSerial.get(deviceIdNorm));
      recordHit('device-id → PIN', byNormPin.get(deviceIdNorm));
      recordHit('device-id → EquipmentID', byNormEqId.get(deviceIdNorm));
    }

    // Case-insensitive contains (most expensive — only do if previous strategies missed).
    if (targetNorm && !lookupAttempts.some((a) => a.match === 'hit')) {
      const containsMatch = equipment.find((e) => {
        const sn = normSerial(e.EquipmentHeader?.SerialNumber) ?? '';
        const pn = normSerial(e.EquipmentHeader?.PIN) ?? '';
        const eq = normSerial(e.EquipmentHeader?.EquipmentID) ?? '';
        return (
          sn.includes(targetNorm) ||
          pn.includes(targetNorm) ||
          eq.includes(targetNorm) ||
          targetNorm.includes(sn) ||
          targetNorm.includes(pn) ||
          targetNorm.includes(eq)
        );
      });
      recordHit('contains-fuzzy (asset-serial)', containsMatch);
    }

    const serialSamples = equipment.slice(0, 10).map((e) => ({
      SerialNumber: e.EquipmentHeader?.SerialNumber,
      PIN: e.EquipmentHeader?.PIN,
      EquipmentID: e.EquipmentHeader?.EquipmentID,
      OEMName: e.EquipmentHeader?.OEMName,
      hasLocation: e.Location?.Latitude != null && e.Location?.Longitude != null,
      hasFuel: e.FuelRemaining?.Percent != null,
      hasHours: e.CumulativeOperatingHours?.Hour != null,
      hasEngineStatus: e.EngineStatus?.Running != null,
    }));

    // For the target machine, include the FULL matched AEMP record so we can
    // see every field AEMP actually returns (fuel, hours, engine status…).
    const targetHit = lookupAttempts.find((a) => a.match === 'hit');
    let targetFullRecord: unknown = null;
    if (targetHit && targetNorm) {
      targetFullRecord = byNormSerial.get(targetNorm) ?? byNormPin.get(targetNorm) ?? null;
    }

    aempDiagnostic = {
      pagesFetched: visited.length,
      hitMaxHopsCap: hops >= MAX_HOPS,
      pagesVisited: visited,
      equipmentCount: equipment.length,
      linksOnPage1: firstPageLinks,
      lastLinkRaw,
      lastLinkParsedNumber,
      targetSerialRaw: target,
      targetSerialNormalized: targetNorm,
      lookupAttempts,
      targetFullRecord,
      serialSamples,
      summary:
        lookupAttempts.find((a) => a.match === 'hit')
          ? `MATCH found via ${lookupAttempts.find((a) => a.match === 'hit')!.via} — wire the same normalization into fetchAllAemp.`
          : equipment.length === 0
            ? 'AEMP returned 0 equipment records. Either the feed is empty for this account or pagination failed early.'
            : `No match for serial "${target}". Asset may be excluded from AEMP feed; compare against serialSamples for format hints.`,
    };
  } catch (err) {
    aempDiagnostic = { error: err instanceof Error ? err.message : String(err) };
  }

  // Try the asset's GraphQL location query too, in case the user has just configured V2.
  let gqlAttempt: unknown = { skipped: 'no V2 token configured' };
  if (gqlToken) {
    const gqlRes = await fetch('https://iris.trackunit.com/api/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${gqlToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
          query Loc($id: ID!) {
            asset(id: $id) {
              id
              name
              lastSeen
              locations {
                latest {
                  geometry { type coordinates }
                  properties { address { streetAddress city country } updatedAt }
                }
              }
            }
          }
        `,
        variables: { id },
      }),
      cache: 'no-store',
    });
    const gqlText = await gqlRes.text();
    gqlAttempt = { status: gqlRes.status, bodyPreview: gqlText.slice(0, 600) };
  }

  return NextResponse.json({
    machine: {
      id: machine.id,
      sourceExternalId: machine.sourceExternalId,
      name: machine.name,
    },
    assetMeta: {
      status: assetMetaRes.status,
      serialNumber,
      preview: assetMetaText.slice(0, 200),
    },
    positionProbes: probes,
    aemp: aempDiagnostic,
    graphQL: gqlAttempt,
    notes:
      'Read the `aemp` block first — it tells us if pagination + the serial-number join work. ' +
      'If `aemp.lookupAttempts` has a hit but the live page shows no map, the snapshot is stale (run sync-all). ' +
      'If no hit and equipmentCount > 0, the asset is excluded from this account\'s AEMP feed.',
  });
}

export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  return handle(ctx);
}

export async function POST(_req: NextRequest, ctx: { params: { id: string } }) {
  return handle(ctx);
}
