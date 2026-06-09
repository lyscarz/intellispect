import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from './supabase/server';
import { createSupabaseAdminClient } from './supabase/admin';

export type SessionContext = {
  userId: string;
  email: string;
  accountId: string;
  accountName: string;
  role: 'account_admin' | 'admin_user' | 'operator';
};

const ACTIVE_ACCOUNT_COOKIE = 'active_account_id';

/**
 * Resolves the authenticated user + their active account, auto-creating one
 * on first visit. Redirects to /login if unauthenticated. Use from any
 * server component or route handler under (app)/.
 */
export async function getSessionContext(): Promise<SessionContext> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const admin = createSupabaseAdminClient();

  // Look up memberships. Service-role bypasses RLS so we see everything for this user.
  const { data: memberships, error: memErr } = await admin
    .from('account_members')
    .select('account_id, role, accounts ( id, name )')
    .eq('user_id', user.id);
  if (memErr) throw new Error(`Failed to load account membership: ${memErr.message}`);

  let memberRow = memberships?.[0];

  // First-visit auto-create: no membership yet → create personal account.
  if (!memberRow) {
    const initialName =
      (user.user_metadata?.initial_account_name as string | undefined) ??
      `${user.email?.split('@')[0] ?? 'My'}'s account`;

    const { data: newAccount, error: insErr } = await admin
      .from('accounts')
      .insert({ name: initialName, created_by: user.id })
      .select('id, name')
      .single();
    if (insErr || !newAccount) throw new Error(`Failed to create account: ${insErr?.message}`);

    const { error: memInsErr } = await admin
      .from('account_members')
      .insert({ account_id: newAccount.id, user_id: user.id, role: 'account_admin' });
    if (memInsErr) throw new Error(`Failed to attach user to account: ${memInsErr.message}`);

    // Auto-create the default fleet alongside the account. Service-role
    // bypass is fine here because the user is the account creator.
    const { error: fleetErr } = await admin
      .from('fleets')
      .insert({
        account_id: newAccount.id,
        name: 'Your fleet',
        slug: 'your-fleet',
        created_by: user.id,
      });
    if (fleetErr) {
      // Non-fatal: account still works without the default fleet (Phase B
      // shows an empty state). Log and continue.
      console.error(`[getSessionContext] Failed to create default fleet: ${fleetErr.message}`);
    }

    memberRow = {
      account_id: newAccount.id,
      role: 'account_admin',
      accounts: { id: newAccount.id, name: newAccount.name },
    } as typeof memberRow;
  }

  // Active account from cookie if it's still valid; else fall back to first membership.
  const cookieStore = cookies();
  const cookieAccountId = cookieStore.get(ACTIVE_ACCOUNT_COOKIE)?.value;
  const validCookie = memberships?.find((m) => m.account_id === cookieAccountId);
  const active = validCookie ?? memberRow;

  // Set cookie if missing or stale. (Server component context — guarded; middleware re-syncs.)
  if (!validCookie) {
    try {
      cookieStore.set(ACTIVE_ACCOUNT_COOKIE, active.account_id, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      });
    } catch {
      // Setting cookies from a server component throws — safe to swallow.
    }
  }

  const accountRow = Array.isArray(active.accounts) ? active.accounts[0] : active.accounts;

  return {
    userId: user.id,
    email: user.email ?? '',
    accountId: active.account_id,
    accountName: (accountRow?.name as string) ?? 'My account',
    role: active.role as SessionContext['role'],
  };
}
