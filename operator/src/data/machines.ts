import { supabase } from '../lib/supabase';
import type { Asset } from '../types';
import { SAMPLE_FLEET } from '../lib/sampleData';

interface MachineRow {
  id: string;
  account_id: string | null;
  name: string;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  status: string | null;
  last_snapshot: Asset | null;
}

/** Map a `machines` row (with its cached Trackunit snapshot) to an Asset. */
function rowToAsset(r: MachineRow): Asset {
  const snap = r.last_snapshot;
  return {
    assetId: r.id,
    accountId: r.account_id,
    name: r.name,
    brand: r.brand,
    model: r.model,
    serialNumber: r.serial_number,
    assetType: snap?.assetType ?? 'MACHINE',
    lastSeen: snap?.lastSeen ?? null,
    activity: snap?.activity ?? null,
    imageUrl: snap?.imageUrl ?? null,
    location: snap?.location ?? null,
    insights:
      snap?.insights ?? {
        fuelLevel: null,
        batteryStateOfChargePercent: null,
        cumulativeOperatingHours: null,
        cumulativeEngineHours: null,
      },
  };
}

/**
 * Read the signed-in user's machines straight from Supabase (RLS scopes them to
 * the user's account, same as the desktop app). Only machines with a known
 * position are useful on the map. Falls back to a bundled sample fleet when the
 * table isn't client-readable or has no located machines — keeps the demo alive.
 */
export async function fetchFleet(): Promise<{ assets: Asset[]; live: boolean }> {
  try {
    const { data, error } = await supabase
      .from('machines')
      .select('id,account_id,name,brand,model,serial_number,status,last_snapshot')
      .limit(500);
    if (error) throw error;

    const located = (data ?? [])
      .map((r) => rowToAsset(r as MachineRow))
      .filter((a) => a.location?.coordinates);

    if (located.length === 0) return { assets: SAMPLE_FLEET, live: false };
    return { assets: located, live: true };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[operator] live machines unavailable, using sample fleet:', (e as Error).message);
    return { assets: SAMPLE_FLEET, live: false };
  }
}
