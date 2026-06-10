import { createSupabaseServerClient } from './supabase/server';
import { createSupabaseAdminClient } from './supabase/admin';
import type { AccountRole } from './types';

export interface AccountMember {
  userId: string;
  email: string;
  role: AccountRole;
  joinedAt: string;
  /** null = unrestricted (account_admin); otherwise the list of fleet IDs. */
  fleetIds: string[] | null;
}

interface MemberRow {
  account_id: string;
  user_id: string;
  role: AccountRole;
  joined_at: string;
}

/** Lists every member of the given account, joining auth.users for emails
 *  (service-role) and member_fleet_access for grants. */
export async function listMembers(accountId: string): Promise<AccountMember[]> {
  const supabase = createSupabaseServerClient();
  const { data: memberRows, error } = await supabase
    .from('account_members')
    .select('account_id, user_id, role, joined_at')
    .eq('account_id', accountId)
    .order('joined_at', { ascending: true });
  if (error) throw new Error(`Failed to list members: ${error.message}`);

  const rows = (memberRows ?? []) as MemberRow[];
  if (rows.length === 0) return [];

  const userIds = rows.map((r) => r.user_id);

  // Emails come from auth.users — only the service-role client can see them.
  const admin = createSupabaseAdminClient();
  const emails = new Map<string, string>();
  // listUsers is paginated; for PoC scale a single page is plenty.
  const { data: usersResp, error: usersErr } = await admin.auth.admin.listUsers({
    perPage: 200,
  });
  if (usersErr) throw new Error(`Failed to load auth users: ${usersErr.message}`);
  for (const u of usersResp?.users ?? []) {
    if (userIds.includes(u.id)) emails.set(u.id, u.email ?? '');
  }

  // Per-member fleet grants.
  const { data: grants, error: grantErr } = await supabase
    .from('member_fleet_access')
    .select('user_id, fleet_id')
    .eq('account_id', accountId)
    .in('user_id', userIds);
  if (grantErr) throw new Error(`Failed to load grants: ${grantErr.message}`);
  const grantsByUser = new Map<string, string[]>();
  for (const g of (grants ?? []) as { user_id: string; fleet_id: string }[]) {
    const arr = grantsByUser.get(g.user_id) ?? [];
    arr.push(g.fleet_id);
    grantsByUser.set(g.user_id, arr);
  }

  return rows.map((r) => ({
    userId: r.user_id,
    email: emails.get(r.user_id) ?? '(unknown)',
    role: r.role,
    joinedAt: r.joined_at,
    fleetIds: r.role === 'account_admin' ? null : grantsByUser.get(r.user_id) ?? [],
  }));
}

export async function updateMemberRole(
  accountId: string,
  userId: string,
  role: AccountRole
): Promise<void> {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from('account_members')
    .update({ role })
    .eq('account_id', accountId)
    .eq('user_id', userId);
  if (error) throw new Error(`Failed to update role: ${error.message}`);
}

export async function removeMember(accountId: string, userId: string): Promise<void> {
  const supabase = createSupabaseServerClient();
  const { error: grantsErr } = await supabase
    .from('member_fleet_access')
    .delete()
    .eq('account_id', accountId)
    .eq('user_id', userId);
  if (grantsErr) throw new Error(`Failed to clear grants: ${grantsErr.message}`);

  const { error } = await supabase
    .from('account_members')
    .delete()
    .eq('account_id', accountId)
    .eq('user_id', userId);
  if (error) throw new Error(`Failed to remove member: ${error.message}`);
}

/** Returns the count of `account_admin` members for an account. Used to block
 *  demoting / removing the last owner. */
export async function countOwners(accountId: string): Promise<number> {
  const supabase = createSupabaseServerClient();
  const { count, error } = await supabase
    .from('account_members')
    .select('user_id', { count: 'exact', head: true })
    .eq('account_id', accountId)
    .eq('role', 'account_admin');
  if (error) throw new Error(`Failed to count owners: ${error.message}`);
  return count ?? 0;
}
