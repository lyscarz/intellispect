'use server';

import { revalidatePath } from 'next/cache';
import { getSessionContext } from '@/lib/getSessionContext';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { deleteMachineImage } from '@/lib/storage';

export interface BulkAssignResult {
  updated: number;
}

/**
 * Bulk-move machines to a different fleet (or unassign by passing `null`).
 * Site assignment is cleared at the same time because sites are per-fleet.
 */
export async function bulkAssignToFleetAction(
  machineIds: string[],
  fleetId: string | null
): Promise<BulkAssignResult> {
  if (machineIds.length === 0) return { updated: 0 };
  const ctx = await getSessionContext();
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from('machines')
    .update({ fleet_id: fleetId, site_id: null })
    .eq('account_id', ctx.accountId)
    .in('id', machineIds);
  if (error) throw new Error(`Failed to assign fleet: ${error.message}`);
  revalidatePath('/fleet');
  revalidatePath('/sites');
  return { updated: machineIds.length };
}

/**
 * Bulk-assign machines to a site (or unassign by passing `null`).
 * Site must belong to the SAME fleet as every selected machine. Throws if any
 * machine is in a different fleet — the UI should pre-filter to make this
 * impossible to trigger.
 */
export async function bulkAssignToSiteAction(
  machineIds: string[],
  siteId: string | null
): Promise<BulkAssignResult> {
  if (machineIds.length === 0) return { updated: 0 };
  const ctx = await getSessionContext();
  const supabase = createSupabaseServerClient();

  if (siteId === null) {
    const { error } = await supabase
      .from('machines')
      .update({ site_id: null })
      .eq('account_id', ctx.accountId)
      .in('id', machineIds);
    if (error) throw new Error(`Failed to unassign site: ${error.message}`);
    revalidatePath('/fleet');
    return { updated: machineIds.length };
  }

  const { data: site, error: siteErr } = await supabase
    .from('sites')
    .select('id, fleet_id')
    .eq('id', siteId)
    .eq('account_id', ctx.accountId)
    .maybeSingle();
  if (siteErr) throw new Error(siteErr.message);
  if (!site) throw new Error('Site not found');

  const { data: machines, error: mErr } = await supabase
    .from('machines')
    .select('id, fleet_id')
    .eq('account_id', ctx.accountId)
    .in('id', machineIds);
  if (mErr) throw new Error(mErr.message);
  const mismatches = (machines ?? []).filter((m) => m.fleet_id !== site.fleet_id);
  if (mismatches.length > 0) {
    throw new Error(
      `${mismatches.length} machine${mismatches.length === 1 ? "" : 's'} aren't in the site's fleet`
    );
  }

  const { error } = await supabase
    .from('machines')
    .update({ site_id: siteId })
    .eq('account_id', ctx.accountId)
    .in('id', machineIds);
  if (error) throw new Error(`Failed to assign site: ${error.message}`);
  revalidatePath('/fleet');
  return { updated: machineIds.length };
}

export interface BulkDisconnectResult {
  disconnected: number;
  deleted: number;
}

/**
 * Bulk action for the fleet list checkboxes. For each id:
 *   manual              → hard delete (and delete its image)
 *   trackunit + active  → soft disconnect (status='disconnected')
 *   trackunit + already disconnected → hard delete (the "Remove permanently" case)
 */
export async function bulkDisconnectAction(machineIds: string[]): Promise<BulkDisconnectResult> {
  if (machineIds.length === 0) return { disconnected: 0, deleted: 0 };

  const ctx = await getSessionContext();
  const supabase = createSupabaseServerClient();

  const { data: machines, error: fetchErr } = await supabase
    .from('machines')
    .select('id, source, status, image_path')
    .eq('account_id', ctx.accountId)
    .in('id', machineIds);
  if (fetchErr) throw new Error(`Failed to load machines: ${fetchErr.message}`);

  const toSoftDisconnect = (machines ?? [])
    .filter((m) => m.source === 'trackunit' && m.status === 'active')
    .map((m) => m.id as string);

  const toHardDelete = (machines ?? [])
    .filter((m) => m.source === 'manual' || m.status === 'disconnected')
    .map((m) => m.id as string);

  const imagesToDelete = (machines ?? [])
    .filter((m) => toHardDelete.includes(m.id as string) && m.image_path)
    .map((m) => m.image_path as string);

  if (toSoftDisconnect.length > 0) {
    const { error } = await supabase
      .from('machines')
      .update({ status: 'disconnected' })
      .eq('account_id', ctx.accountId)
      .in('id', toSoftDisconnect);
    if (error) throw new Error(`Failed to disconnect: ${error.message}`);
  }

  if (toHardDelete.length > 0) {
    const { error } = await supabase
      .from('machines')
      .delete()
      .eq('account_id', ctx.accountId)
      .in('id', toHardDelete);
    if (error) throw new Error(`Failed to delete: ${error.message}`);
  }

  if (imagesToDelete.length > 0) {
    // Best-effort — don't fail the action if storage cleanup hiccups.
    await Promise.allSettled(imagesToDelete.map((p) => deleteMachineImage(p)));
  }

  revalidatePath('/fleet');
  return { disconnected: toSoftDisconnect.length, deleted: toHardDelete.length };
}
