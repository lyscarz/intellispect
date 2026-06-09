import { NextResponse, type NextRequest } from 'next/server';
import { getSessionContext } from '@/lib/getSessionContext';
import { getMachine } from '@/lib/machines';
import { getActiveTrackunitClient } from '@/lib/telematics/get-client';

/**
 * Probe Trackunit DEVICE-based endpoints. The Asset API revealed each asset
 * carries a `telematicsDevices: [{ id, serialNumber }]` — devices are what
 * actually report position/fuel/hours. We probably need to call device
 * endpoints, not asset endpoints, for telemetry.
 *
 * Also tries AEMP keyed by device serial (the missing join key) and by
 * device id, plus per-device REST candidates.
 */
async function handle({ params }: { params: { id: string } }) {
  const ctx = await getSessionContext();
  const machine = await getMachine(params.id, ctx.accountId);
  if (!machine) return NextResponse.json({ error: 'machine not found' }, { status: 404 });
  if (machine.source !== 'trackunit' || !machine.sourceExternalId) {
    return NextResponse.json({ error: 'not a Trackunit machine' }, { status: 400 });
  }

  const client = await getActiveTrackunitClient(ctx.accountId);
  if (!client) return NextResponse.json({ error: 'no active Trackunit connection' }, { status: 400 });

  const restToken = await client.provider.getRestToken();
  const id = machine.sourceExternalId;

  async function tryFetch(url: string) {
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${restToken}`, Accept: 'application/json' },
        cache: 'no-store',
      });
      const text = await res.text();
      const ct = res.headers.get('content-type') ?? '';
      let body: unknown = text.slice(0, 600);
      if (ct.includes('application/json')) {
        try {
          body = JSON.parse(text);
        } catch {}
      }
      return { url, status: res.status, contentType: ct, body };
    } catch (err) {
      return { url, error: err instanceof Error ? err.message : String(err) };
    }
  }

  // 1. FULL Asset API response — to capture telematicsDevices.
  const assetFull = await tryFetch(`https://iris.trackunit.com/api/asset/v2/assets/${id}`);
  const assetBody = (assetFull as { body?: Record<string, unknown> }).body as
    | {
        serialNumber?: string;
        telematicsDevices?: Array<{ id: string; serialNumber?: string }>;
      }
    | undefined;

  const assetSerial = assetBody?.serialNumber ?? null;
  const devices = assetBody?.telematicsDevices ?? [];
  const primaryDevice = devices[0];
  const deviceId = primaryDevice?.id ?? null;
  const deviceSerial = primaryDevice?.serialNumber ?? null;

  // 2. Probe device-centric endpoints — both by device UUID and by device serial.
  const devicePathProbes: Array<unknown> = [];
  if (deviceId) {
    devicePathProbes.push(
      ...(await Promise.all([
        tryFetch(`https://iris.trackunit.com/api/device/v2/devices/${deviceId}`),
        tryFetch(`https://iris.trackunit.com/api/device/v2/devices/${deviceId}/position`),
        tryFetch(`https://iris.trackunit.com/api/device/v2/devices/${deviceId}/positions`),
        tryFetch(`https://iris.trackunit.com/api/device/v2/devices/${deviceId}/positions/latest`),
        tryFetch(`https://iris.trackunit.com/api/device/v2/devices/${deviceId}/telematics`),
        tryFetch(`https://iris.trackunit.com/api/device/v2/devices/${deviceId}/status`),
        tryFetch(`https://iris.trackunit.com/api/device/v2/devices/${deviceId}/insights`),
        tryFetch(`https://iris.trackunit.com/api/device/v2/devices/${deviceId}/lastPosition`),
        tryFetch(`https://iris.trackunit.com/api/devices/v2/${deviceId}`),
        tryFetch(`https://iris.trackunit.com/api/iris/devices/${deviceId}`),
        tryFetch(`https://iris.trackunit.com/api/iris/devices/${deviceId}/positions/latest`),
      ]))
    );
  }
  if (deviceSerial) {
    devicePathProbes.push(
      ...(await Promise.all([
        tryFetch(
          `https://iris.trackunit.com/public/api/aemp/v2/15143/-3/Equipment/${encodeURIComponent(deviceSerial)}`
        ),
        tryFetch(
          `https://iris.trackunit.com/api/device/v2/devices?serialNumber=${encodeURIComponent(deviceSerial)}`
        ),
      ]))
    );
  }

  // 3. Also probe asset-with-device-related sub-paths we haven't tried.
  const assetDeviceProbes = await Promise.all([
    tryFetch(`https://iris.trackunit.com/api/asset/v2/assets/${id}/devices`),
    tryFetch(`https://iris.trackunit.com/api/asset/v2/assets/${id}/telematicsDevices`),
    tryFetch(`https://iris.trackunit.com/api/asset/v2/assets/${id}/positions/latest`),
    tryFetch(`https://iris.trackunit.com/api/asset/v2/assets/${id}/insights/latest`),
  ]);

  return NextResponse.json({
    machine: { id: machine.id, sourceExternalId: id, name: machine.name },
    assetSerial,
    devices,
    primaryDevice: { id: deviceId, serialNumber: deviceSerial },
    skippedAemp:
      'AEMP returned 429 last time — back off. Will re-probe via /api/machines/[id]/aemp-only when ready.',
    assetApiFullResponse: assetFull,
    devicePathProbes,
    assetDeviceProbes,
    notes:
      "Look for any status=200 with a JSON body that contains lat/lng/latitude/longitude. " +
      "The asset has a telematicsDevices array — that's the hardware tracker. Device endpoints are the most likely source of position data. " +
      "We'll also need to try keying AEMP by deviceSerial, not assetSerial, once the 429 rate-limit clears.",
  });
}

export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  return handle(ctx);
}
