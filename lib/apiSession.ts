import type { NextRequest } from 'next/server';
import { getSessionContext } from './getSessionContext';
import { createSupabaseAdminClient } from './supabase/admin';

/**
 * Minimal auth context for API routes that may be called either by the desktop
 * app (cookie session) OR by the standalone mobile operator app (Bearer token,
 * since it has no cookies on this origin).
 */
export interface ApiSession {
  userId: string;
  accountId: string;
}

/** Thrown when a Bearer-authenticated request can't be resolved. Routes map
 *  this to a 401 (a redirect, as getSessionContext does, is wrong for fetch). */
export class ApiAuthError extends Error {
  status = 401;
  constructor(message: string) {
    super(message);
    this.name = 'ApiAuthError';
  }
}

/**
 * Resolve the caller's user + active account.
 *  - `Authorization: Bearer <token>` → validate the Supabase access token with
 *    the service-role client and resolve the account from `account_members`
 *    (first membership, or `x-account-id` when it matches one). Used by mobile.
 *  - No token → fall back to the cookie-based `getSessionContext()`. Used by the
 *    desktop app's own same-origin fetches.
 */
export async function resolveApiSession(req: NextRequest): Promise<ApiSession> {
  const auth = req.headers.get('authorization');
  const token =
    auth && auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : null;

  if (token) {
    const admin = createSupabaseAdminClient();
    const {
      data: { user },
      error,
    } = await admin.auth.getUser(token);
    if (error || !user) throw new ApiAuthError('Invalid or expired token');

    const { data: members, error: memErr } = await admin
      .from('account_members')
      .select('account_id')
      .eq('user_id', user.id);
    if (memErr) throw new ApiAuthError(`Failed to resolve account: ${memErr.message}`);

    const ids = (members ?? []).map((m) => (m as { account_id: string }).account_id);
    if (ids.length === 0) throw new ApiAuthError('User has no account membership');

    const requested = req.headers.get('x-account-id');
    const accountId = requested && ids.includes(requested) ? requested : ids[0];
    return { userId: user.id, accountId };
  }

  // Cookie fallback — desktop's own calls. getSessionContext redirects if there
  // is no session, which is the existing behaviour for those callers.
  const ctx = await getSessionContext();
  return { userId: ctx.userId, accountId: ctx.accountId };
}

/**
 * Authoritatively resolve which account a machine belongs to, *verifying* the
 * caller is a member of that account. Returns null if the machine doesn't exist
 * or the user isn't a member. This sidesteps the multi-account ambiguity in
 * resolveApiSession (the operator may belong to several accounts, and the
 * machine's own account is the only correct one for getMachine/getTemplate).
 */
export async function resolveAccountForMachine(
  userId: string,
  machineId: string
): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  const { data: machine } = await admin
    .from('machines')
    .select('account_id')
    .eq('id', machineId)
    .maybeSingle();
  const acct = (machine as { account_id: string } | null)?.account_id;
  if (!acct) return null;

  const { data: member } = await admin
    .from('account_members')
    .select('account_id')
    .eq('user_id', userId)
    .eq('account_id', acct)
    .maybeSingle();
  return member ? acct : null;
}

// ─── CORS ───────────────────────────────────────────────────────────────────
// The mobile operator app runs on its own dev origin (Vite, :5180) and in
// preview tooling, so cross-origin POSTs need explicit CORS. Secrets stay
// server-side; only the inspection routes opt in.

const ALLOWED_ORIGINS = new Set([
  'http://localhost:5180',
  'http://localhost:5173',
  'http://127.0.0.1:5180',
]);

export function corsHeaders(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : 'http://localhost:5180';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type, x-account-id',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

/** Standard preflight response for the inspection routes. */
export function corsPreflight(req: NextRequest): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get('origin')) });
}
