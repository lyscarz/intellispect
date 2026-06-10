import { nanoid } from 'nanoid';
import { createSupabaseServerClient } from './supabase/server';
import { createSupabaseAdminClient } from './supabase/admin';
import { grantFleetsAsAdmin } from './fleet-access';
import type { AccountRole } from './types';

export interface AccountInvite {
  id: string;
  accountId: string;
  email: string;
  role: AccountRole;
  token: string;
  invitedBy: string;
  expiresAt: string;
  acceptedAt: string | null;
  allowedFleetIds: string[];
  createdAt?: string;
}

interface InviteRow {
  id: string;
  account_id: string;
  email: string;
  role: AccountRole;
  token: string;
  invited_by: string;
  expires_at: string;
  accepted_at: string | null;
  allowed_fleet_ids: string[];
}

function rowToInvite(r: InviteRow): AccountInvite {
  return {
    id: r.id,
    accountId: r.account_id,
    email: r.email,
    role: r.role,
    token: r.token,
    invitedBy: r.invited_by,
    expiresAt: r.expires_at,
    acceptedAt: r.accepted_at,
    allowedFleetIds: r.allowed_fleet_ids ?? [],
  };
}

const INVITE_TTL_DAYS = 7;

export async function listInvites(accountId: string): Promise<AccountInvite[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('account_invites')
    .select('*')
    .eq('account_id', accountId)
    .is('accepted_at', null)
    .order('expires_at', { ascending: true });
  if (error) throw new Error(`Failed to list invites: ${error.message}`);
  return (data ?? []).map((r) => rowToInvite(r as InviteRow));
}

export interface CreateInviteInput {
  accountId: string;
  invitedBy: string;
  email: string;
  role: AccountRole;
  allowedFleetIds: string[];
}

export interface CreateInviteResult {
  invite: AccountInvite;
  magicLink: string;
  emailDeliveryError?: string;
}

/** Inserts an account_invites row, then asks Supabase Auth to send a magic-link
 *  invite email pointing at /accept-invite?token=<our-token>. If Supabase's
 *  email send fails (rate limit, SMTP not configured), the invite still exists
 *  and the magic link is returned for the owner to copy manually. */
export async function createInvite(
  input: CreateInviteInput,
  appOrigin: string
): Promise<CreateInviteResult> {
  const email = input.email.trim().toLowerCase();
  if (!email) throw new Error('Email is required');

  const token = nanoid(40);
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // account_invites has only a SELECT RLS policy (see 0001). Use the
  // service-role client for the INSERT — the calling server action already
  // verified the caller is an account_admin via ensureOwner().
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('account_invites')
    .insert({
      account_id: input.accountId,
      email,
      role: input.role,
      token,
      invited_by: input.invitedBy,
      expires_at: expiresAt,
      allowed_fleet_ids: input.allowedFleetIds,
    })
    .select('*')
    .single();
  if (error || !data) throw new Error(`Failed to create invite: ${error?.message}`);
  const invite = rowToInvite(data as InviteRow);

  const magicLink = `${appOrigin.replace(/\/$/, '')}/accept-invite?token=${token}`;

  // Best-effort: ask Supabase Auth to send the magic-link invite email.
  // Failures here (rate limits, SMTP not configured) leave the magicLink as a
  // manual-share fallback rather than blocking the inviter.
  let emailDeliveryError: string | undefined;
  try {
    const admin = createSupabaseAdminClient();
    const { error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: magicLink,
    });
    if (inviteErr) emailDeliveryError = inviteErr.message;
  } catch (e) {
    emailDeliveryError = (e as Error).message;
  }

  return { invite, magicLink, emailDeliveryError };
}

export async function getInviteByToken(token: string): Promise<AccountInvite | null> {
  // The accept-invite flow runs in the invitee's session, who isn't yet a
  // member of the target account — RLS would deny. Use the admin client.
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('account_invites')
    .select('*')
    .eq('token', token)
    .maybeSingle();
  if (error) throw new Error(`Failed to load invite: ${error.message}`);
  return data ? rowToInvite(data as InviteRow) : null;
}

/** Accept an invite: insert into account_members + fan out the allowed fleets
 *  into member_fleet_access, mark invite accepted. All via the admin client so
 *  the brand-new member's session can complete the writes before they're a
 *  recognised member of the account. */
export async function acceptInvite(token: string, userId: string): Promise<AccountInvite> {
  const invite = await getInviteByToken(token);
  if (!invite) throw new Error('Invite not found or revoked');
  if (invite.acceptedAt) throw new Error('Invite has already been accepted');
  if (new Date(invite.expiresAt).getTime() < Date.now()) {
    throw new Error('Invite has expired');
  }

  const admin = createSupabaseAdminClient();

  // 1. Membership.
  const { error: memberErr } = await admin.from('account_members').upsert(
    {
      account_id: invite.accountId,
      user_id: userId,
      role: invite.role,
    },
    { onConflict: 'account_id,user_id' }
  );
  if (memberErr) throw new Error(`Failed to add member: ${memberErr.message}`);

  // 2. Per-fleet grants.
  if (invite.role !== 'account_admin' && invite.allowedFleetIds.length > 0) {
    await grantFleetsAsAdmin(
      invite.accountId,
      userId,
      invite.allowedFleetIds,
      invite.invitedBy
    );
  }

  // 3. Mark accepted.
  const { error: updErr } = await admin
    .from('account_invites')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invite.id);
  if (updErr) throw new Error(`Failed to mark invite accepted: ${updErr.message}`);

  return invite;
}

export async function revokeInvite(accountId: string, id: string): Promise<void> {
  // Same RLS gap as the INSERT path — use the admin client. The calling server
  // action already gated this behind ensureOwner().
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from('account_invites')
    .delete()
    .eq('account_id', accountId)
    .eq('id', id);
  if (error) throw new Error(`Failed to revoke invite: ${error.message}`);
}
