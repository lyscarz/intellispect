import { createSupabaseServerClient } from './supabase/server';
import type { Asset, Machine } from './types';

interface MachineRow {
  id: string;
  account_id: string;
  source: Machine['source'];
  source_external_id: string | null;
  source_connection_id: string | null;
  status: Machine['status'];
  name: string;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  site: string | null;
  fleet_id: string | null;
  site_id: string | null;
  image_path: string | null;
  last_snapshot: Asset | null;
  last_synced_at: string | null;
  created_at: string;
  created_by: string | null;
}

function rowToMachine(r: MachineRow): Machine {
  return {
    id: r.id,
    accountId: r.account_id,
    source: r.source,
    sourceExternalId: r.source_external_id,
    sourceConnectionId: r.source_connection_id,
    status: r.status,
    name: r.name,
    brand: r.brand,
    model: r.model,
    serialNumber: r.serial_number,
    site: r.site,
    fleetId: r.fleet_id,
    siteId: r.site_id,
    imagePath: r.image_path,
    lastSnapshot: r.last_snapshot,
    lastSyncedAt: r.last_synced_at,
    createdAt: r.created_at,
    createdBy: r.created_by,
  };
}

export async function listMachinesForAccount(accountId: string): Promise<Machine[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('machines')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Failed to list machines: ${error.message}`);
  return (data ?? []).map((r) => rowToMachine(r as MachineRow));
}

export async function getMachine(machineId: string, accountId: string): Promise<Machine | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('machines')
    .select('*')
    .eq('id', machineId)
    .eq('account_id', accountId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load machine: ${error.message}`);
  return data ? rowToMachine(data as MachineRow) : null;
}

export interface CreateManualMachineInput {
  name: string;
  brand?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  site?: string | null;
  fleetId?: string | null;
  siteId?: string | null;
}

export async function createManualMachine(
  accountId: string,
  userId: string,
  input: CreateManualMachineInput
): Promise<Machine> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('machines')
    .insert({
      account_id: accountId,
      source: 'manual',
      status: 'active',
      name: input.name,
      brand: input.brand ?? null,
      model: input.model ?? null,
      serial_number: input.serialNumber ?? null,
      site: input.site ?? null,
      fleet_id: input.fleetId ?? null,
      site_id: input.siteId ?? null,
      created_by: userId,
    })
    .select('*')
    .single();
  if (error || !data) throw new Error(`Failed to create machine: ${error?.message}`);
  return rowToMachine(data as MachineRow);
}

export interface UpdateMachineInput {
  name?: string;
  brand?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  site?: string | null;
  imagePath?: string | null;
  /** Set `null` to unassign from a fleet. Changing fleet auto-clears `siteId`. */
  fleetId?: string | null;
  /** Site assignment. Must belong to the machine's fleet — validated server-side. */
  siteId?: string | null;
}

export async function updateMachine(
  machineId: string,
  accountId: string,
  input: UpdateMachineInput
): Promise<Machine> {
  const supabase = createSupabaseServerClient();
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.brand !== undefined) patch.brand = input.brand;
  if (input.model !== undefined) patch.model = input.model;
  if (input.serialNumber !== undefined) patch.serial_number = input.serialNumber;
  if (input.site !== undefined) patch.site = input.site;
  if (input.imagePath !== undefined) patch.image_path = input.imagePath;

  // Fleet/site assignment with invariant: site must belong to the machine's fleet,
  // and changing fleet clears the site automatically.
  if (input.fleetId !== undefined || input.siteId !== undefined) {
    const { data: existing } = await supabase
      .from('machines')
      .select('fleet_id')
      .eq('id', machineId)
      .eq('account_id', accountId)
      .maybeSingle();
    const currentFleet = existing?.fleet_id ?? null;
    const nextFleet = input.fleetId !== undefined ? input.fleetId : currentFleet;
    if (input.fleetId !== undefined) patch.fleet_id = input.fleetId;

    // Fleet change: site can't survive.
    if (input.fleetId !== undefined && input.fleetId !== currentFleet) {
      patch.site_id = null;
    }

    if (input.siteId !== undefined) {
      if (input.siteId === null) {
        patch.site_id = null;
      } else if (nextFleet) {
        const { data: site } = await supabase
          .from('sites')
          .select('fleet_id')
          .eq('id', input.siteId)
          .eq('account_id', accountId)
          .maybeSingle();
        if (!site) throw new Error('Site not found');
        if (site.fleet_id !== nextFleet) {
          throw new Error("Site doesn't belong to this machine's fleet");
        }
        patch.site_id = input.siteId;
      } else {
        throw new Error('Cannot assign a site without a fleet');
      }
    }
  }

  const { data, error } = await supabase
    .from('machines')
    .update(patch)
    .eq('id', machineId)
    .eq('account_id', accountId)
    .select('*')
    .single();
  if (error || !data) throw new Error(`Failed to update machine: ${error?.message}`);
  return rowToMachine(data as MachineRow);
}

/**
 * Delete a manual machine outright. For Trackunit-connected machines, see
 * `softDisconnectMachine` — connected rows soft-disconnect so manual edits survive.
 */
export async function deleteMachine(machineId: string, accountId: string): Promise<void> {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from('machines')
    .delete()
    .eq('id', machineId)
    .eq('account_id', accountId);
  if (error) throw new Error(`Failed to delete machine: ${error.message}`);
}

/**
 * Merge a freshly-fetched snapshot with the previous one, preserving any
 * previously-known telemetry that the new fetch couldn't provide.
 *
 * The Trackunit REST + AEMP path returns location/insights/activity as null
 * when AEMP fails or rate-limits. Without merging, a single 429 wipes out
 * good location data from the DB and the map disappears. Merging means:
 *   - Fresh metadata always wins (name, brand, model can change)
 *   - Live telemetry only updates when the new value is non-null
 */
export function mergeAssetSnapshot(prev: Asset | null, next: Asset): Asset {
  if (!prev) return next;
  return {
    ...next,
    imageUrl: next.imageUrl ?? prev.imageUrl,
    lastSeen: next.lastSeen ?? prev.lastSeen,
    activity: next.activity ?? prev.activity,
    location: next.location ?? prev.location,
    insights: {
      fuelLevel: next.insights.fuelLevel ?? prev.insights.fuelLevel,
      batteryStateOfChargePercent:
        next.insights.batteryStateOfChargePercent ?? prev.insights.batteryStateOfChargePercent,
      cumulativeOperatingHours:
        next.insights.cumulativeOperatingHours ?? prev.insights.cumulativeOperatingHours,
      cumulativeEngineHours:
        next.insights.cumulativeEngineHours ?? prev.insights.cumulativeEngineHours,
    },
    topAlert: next.topAlert ?? prev.topAlert,
    // Iter 6: keep last-known criticality + site reference when a fresh fetch
    // doesn't include them (e.g. REST/AEMP fallback never sets these).
    attention: next.attention ?? prev.attention ?? null,
    trackunitSite: next.trackunitSite ?? prev.trackunitSite ?? null,
    // Iter 8: events come from the per-machine GraphQL refresh. Cron's fleet
    // walk (REST/AEMP path or events-less fleet GQL) leaves `next.events`
    // empty — preserve the last known list rather than blanking the UI.
    events: next.events && next.events.length > 0 ? next.events : prev.events ?? [],
  };
}

/** Map a Machine row to the existing Asset shape used by MachineCard. */
export function machineToAsset(machine: Machine, signedImageUrl: string | null): Asset {
  // For connected machines, prefer fields from the row (user may have renamed them)
  // but fall back to the snapshot's telematics data.
  const snap = machine.lastSnapshot;
  return {
    assetId: machine.id,
    name: machine.name,
    brand: machine.brand,
    model: machine.model,
    serialNumber: machine.serialNumber,
    assetType: snap?.assetType ?? 'MACHINE',
    lastSeen: snap?.lastSeen ?? null,
    activity: snap?.activity ?? null,
    imageUrl: signedImageUrl ?? snap?.imageUrl ?? null,
    location: snap?.location ?? null,
    insights: snap?.insights ?? {
      fuelLevel: null,
      batteryStateOfChargePercent: null,
      cumulativeOperatingHours: null,
      cumulativeEngineHours: null,
    },
    topAlert: snap?.topAlert ?? null,
    attention: snap?.attention ?? null,
    trackunitSite: snap?.trackunitSite ?? null,
    events: snap?.events ?? [],
  };
}
