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
function rowToAsset(r: MachineRow, nameById: Map<string, string>): Asset {
  const snap = r.last_snapshot;
  return {
    assetId: r.id,
    accountId: r.account_id,
    accountName: r.account_id ? nameById.get(r.account_id) ?? null : null,
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
 * the user's accounts, same as the desktop app). Returns ALL machines so the
 * count matches the desktop — ones without coordinates simply aren't plotted on
 * the map (the list + count still include them). Falls back to a bundled sample
 * fleet only when the table is empty/unreadable, keeping the demo alive.
 */
export async function fetchFleet(): Promise<{ assets: Asset[]; live: boolean }> {
  try {
    const [machinesRes, accountsRes] = await Promise.all([
      supabase
        .from('machines')
        .select('id,account_id,name,brand,model,serial_number,status,last_snapshot')
        .limit(1000),
      // Account names for the company filter (RLS scopes to the user's accounts).
      supabase.from('accounts').select('id,name'),
    ]);
    if (machinesRes.error) throw machinesRes.error;

    const nameById = new Map<string, string>(
      (accountsRes.data ?? []).map((a) => [(a as { id: string }).id, (a as { name: string }).name])
    );

    const assets = (machinesRes.data ?? []).map((r) => rowToAsset(r as MachineRow, nameById));

    if (assets.length === 0) return { assets: SAMPLE_FLEET, live: false };
    return { assets, live: true };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[operator] live machines unavailable, using sample fleet:', (e as Error).message);
    return { assets: SAMPLE_FLEET, live: false };
  }
}
