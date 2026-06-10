import { createSupabaseServerClient } from './supabase/server';
import { createSupabaseAdminClient } from './supabase/admin';
import type { AccountRole } from './types';

/** Returns the set of fleet IDs the given user can access in this account.
 *  - null         → unrestricted (account_admin / platform_admin)
 *  - string[]     → explicitly scoped to these fleet IDs (may be [])
 *
 *  Callers thread this into every list query that returns fleet-keyed rows. */
export async function fleetIdsForUser(
  accountId: string,
  userId: string,
  role: AccountRole
): Promise<string[] | null> {
  if (role === 'account_admin') return null;

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('member_fleet_access')
    .select('fleet_id')
    .eq('account_id', accountId)
    .eq('user_id', userId);
  if (error) throw new Error(`Failed to load fleet access: ${error.message}`);
  return (data ?? []).map((r) => (r as { fleet_id: string }).fleet_id);
}

export async function listGrants(
  accountId: string,
  targetUserId: string
): Promise<string[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('member_fleet_access')
    .select('fleet_id')
    .eq('account_id', accountId)
    .eq('user_id', targetUserId);
  if (error) throw new Error(`Failed to load grants: ${error.message}`);
  return (data ?? []).map((r) => (r as { fleet_id: string }).fleet_id);
}

export async function grantFleet(
  accountId: string,
  targetUserId: string,
  fleetId: string,
  grantedBy: string
): Promise<void> {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from('member_fleet_access').upsert(
    {
      account_id: accountId,
      user_id: targetUserId,
      fleet_id: fleetId,
      granted_by: grantedBy,
    },
    { onConflict: 'account_id,user_id,fleet_id' }
  );
  if (error) throw new Error(`Failed to grant fleet: ${error.message}`);
}

export async function revokeFleet(
  accountId: string,
  targetUserId: string,
  fleetId: string
): Promise<void> {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from('member_fleet_access')
    .delete()
    .eq('account_id', accountId)
    .eq('user_id', targetUserId)
    .eq('fleet_id', fleetId);
  if (error) throw new Error(`Failed to revoke fleet: ${error.message}`);
}

/** Service-role variant used during invite acceptance, when the new member's
 *  session doesn't yet satisfy the is_member_of() RLS check. */
export async function grantFleetsAsAdmin(
  accountId: string,
  targetUserId: string,
  fleetIds: string[],
  grantedBy: string | null
): Promise<void> {
  if (fleetIds.length === 0) return;
  const admin = createSupabaseAdminClient();
  const rows = fleetIds.map((fleet_id) => ({
    account_id: accountId,
    user_id: targetUserId,
    fleet_id,
    granted_by: grantedBy,
  }));
  const { error } = await admin
    .from('member_fleet_access')
    .upsert(rows, { onConflict: 'account_id,user_id,fleet_id' });
  if (error) throw new Error(`Failed to grant fleets: ${error.message}`);
}
