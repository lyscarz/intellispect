import { createSupabaseServerClient } from './supabase/server';
import { createSupabaseAdminClient } from './supabase/admin';
import type { Fleet } from './types';

interface FleetRow {
  id: string;
  account_id: string;
  name: string;
  slug: string;
  color: string | null;
  created_at: string;
}

function rowToFleet(r: FleetRow): Fleet {
  return {
    id: r.id,
    accountId: r.account_id,
    name: r.name,
    slug: r.slug,
    color: r.color,
    createdAt: r.created_at,
  };
}

/** Lowercase, dashes for non-alphanumeric, trim leading/trailing dashes. */
export function slugify(name: string): string {
  const s = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s || 'fleet';
}

/** Find a slug that doesn't collide with existing fleets in this account. */
async function uniqueSlug(accountId: string, base: string): Promise<string> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from('fleets')
    .select('slug')
    .eq('account_id', accountId);
  const taken = new Set((data ?? []).map((r) => r.slug as string));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

export async function listFleetsForAccount(accountId: string): Promise<Fleet[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('fleets')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`Failed to list fleets: ${error.message}`);
  return (data ?? []).map((r) => rowToFleet(r as FleetRow));
}

export async function getFleetBySlug(accountId: string, slug: string): Promise<Fleet | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('fleets')
    .select('*')
    .eq('account_id', accountId)
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw new Error(`Failed to load fleet: ${error.message}`);
  return data ? rowToFleet(data as FleetRow) : null;
}

export interface FleetCount {
  fleetId: string | null;
  count: number;
}

/** Returns [{ fleetId, count }] including a fleetId=null bucket for unassigned. */
export async function countMachinesByFleet(accountId: string): Promise<FleetCount[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('machines')
    .select('fleet_id')
    .eq('account_id', accountId);
  if (error) throw new Error(`Failed to count machines: ${error.message}`);
  const counts = new Map<string | null, number>();
  for (const row of data ?? []) {
    const fid = (row.fleet_id as string | null) ?? null;
    counts.set(fid, (counts.get(fid) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([fleetId, count]) => ({ fleetId, count }));
}

export async function createFleet(
  accountId: string,
  userId: string,
  name: string
): Promise<Fleet> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Fleet name is required');
  const baseSlug = slugify(trimmed);
  const slug = await uniqueSlug(accountId, baseSlug);

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('fleets')
    .insert({ account_id: accountId, name: trimmed, slug, created_by: userId })
    .select('*')
    .single();
  if (error || !data) throw new Error(`Failed to create fleet: ${error?.message}`);
  return rowToFleet(data as FleetRow);
}

export async function renameFleet(
  fleetId: string,
  accountId: string,
  newName: string
): Promise<Fleet> {
  const trimmed = newName.trim();
  if (!trimmed) throw new Error('Fleet name is required');
  // Slug re-derived from new name with conflict resolution.
  const baseSlug = slugify(trimmed);
  const slug = await uniqueSlug(accountId, baseSlug);

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('fleets')
    .update({ name: trimmed, slug })
    .eq('id', fleetId)
    .eq('account_id', accountId)
    .select('*')
    .single();
  if (error || !data) throw new Error(`Failed to rename fleet: ${error?.message}`);
  return rowToFleet(data as FleetRow);
}

export async function deleteFleet(fleetId: string, accountId: string): Promise<void> {
  const supabase = createSupabaseServerClient();
  // Block deletion if machines still reference the fleet (UX flow asks user to move them first).
  const { count, error: countErr } = await supabase
    .from('machines')
    .select('id', { count: 'exact', head: true })
    .eq('account_id', accountId)
    .eq('fleet_id', fleetId);
  if (countErr) throw new Error(`Failed to check fleet membership: ${countErr.message}`);
  if ((count ?? 0) > 0) {
    throw new Error(
      `This fleet has ${count} machine${count === 1 ? '' : 's'}. Move or remove them before deleting the fleet.`
    );
  }
  const { error } = await supabase
    .from('fleets')
    .delete()
    .eq('id', fleetId)
    .eq('account_id', accountId);
  if (error) throw new Error(`Failed to delete fleet: ${error.message}`);
}

/**
 * Service-role version of createFleet used during account auto-create.
 * RLS is bypassed so this works during the first-visit bootstrap when the
 * member row may not be visible to the user's session yet.
 */
export async function createDefaultFleetForAccount(
  accountId: string,
  userId: string | null
): Promise<Fleet> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('fleets')
    .insert({ account_id: accountId, name: 'Your fleet', slug: 'your-fleet', created_by: userId })
    .select('*')
    .single();
  if (error || !data) throw new Error(`Failed to create default fleet: ${error?.message}`);
  return rowToFleet(data as FleetRow);
}

/**
 * Return the account's oldest fleet id (admin client; bypasses RLS). Used by
 * cron's sync-sites to pick a default `fleet_id` for newly-imported Trackunit
 * sites — users can re-fleet them later in /sites.
 *
 * Returns null only if the account somehow has zero fleets, which shouldn't
 * happen given the 0002 migration backfill + getSessionContext auto-create.
 */
export async function getDefaultFleetIdAsAdmin(accountId: string): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('fleets')
    .select('id')
    .eq('account_id', accountId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Failed to load default fleet: ${error.message}`);
  return (data as { id: string } | null)?.id ?? null;
}
