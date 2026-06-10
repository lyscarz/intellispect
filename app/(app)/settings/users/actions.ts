'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { getSessionContext } from '@/lib/getSessionContext';
import { createInvite, revokeInvite } from '@/lib/invites';
import {
  countOwners,
  removeMember,
  updateMemberRole,
} from '@/lib/members';
import { grantFleet, revokeFleet } from '@/lib/fleet-access';
import type { AccountRole } from '@/lib/types';

function ensureOwner(role: AccountRole) {
  if (role !== 'account_admin') {
    throw new Error('Only account owners can manage members');
  }
}

function appOrigin(): string {
  // The invite magic link points back at our app — derive the host from the
  // incoming request. Falls back to NEXT_PUBLIC_APP_URL if set.
  const h = headers();
  const origin =
    h.get('origin') ??
    h.get('referer')?.replace(/(https?:\/\/[^/]+).*/, '$1') ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'http://localhost:3000';
  return origin;
}

export interface CreateInviteResult {
  inviteId: string;
  magicLink: string;
  emailDeliveryError?: string;
}

export async function createInviteAction(input: {
  email: string;
  role: 'admin_user' | 'operator';
  allowedFleetIds: string[];
}): Promise<CreateInviteResult> {
  const ctx = await getSessionContext();
  ensureOwner(ctx.role);

  const result = await createInvite(
    {
      accountId: ctx.accountId,
      invitedBy: ctx.userId,
      email: input.email,
      role: input.role,
      allowedFleetIds: input.allowedFleetIds,
    },
    appOrigin()
  );

  revalidatePath('/settings/users');
  return {
    inviteId: result.invite.id,
    magicLink: result.magicLink,
    emailDeliveryError: result.emailDeliveryError,
  };
}

export async function revokeInviteAction(inviteId: string): Promise<void> {
  const ctx = await getSessionContext();
  ensureOwner(ctx.role);
  await revokeInvite(ctx.accountId, inviteId);
  revalidatePath('/settings/users');
}

export async function updateMemberRoleAction(
  userId: string,
  role: AccountRole
): Promise<void> {
  const ctx = await getSessionContext();
  ensureOwner(ctx.role);

  // Prevent demoting the last owner.
  if (role !== 'account_admin') {
    const owners = await countOwners(ctx.accountId);
    // If we're demoting the last remaining owner, refuse.
    const isThisMemberAnOwner = userId === ctx.userId; // shortcut; only owners can call this
    if (owners <= 1 && isThisMemberAnOwner) {
      throw new Error('Cannot demote the only remaining owner');
    }
  }

  await updateMemberRole(ctx.accountId, userId, role);
  revalidatePath('/settings/users');
}

export async function removeMemberAction(userId: string): Promise<void> {
  const ctx = await getSessionContext();
  ensureOwner(ctx.role);

  if (userId === ctx.userId) {
    const owners = await countOwners(ctx.accountId);
    if (owners <= 1) throw new Error('Cannot remove yourself — you are the only owner');
  }

  await removeMember(ctx.accountId, userId);
  revalidatePath('/settings/users');
}

export async function grantFleetAction(userId: string, fleetId: string): Promise<void> {
  const ctx = await getSessionContext();
  ensureOwner(ctx.role);
  await grantFleet(ctx.accountId, userId, fleetId, ctx.userId);
  revalidatePath('/settings/users');
}

export async function revokeFleetAction(userId: string, fleetId: string): Promise<void> {
  const ctx = await getSessionContext();
  ensureOwner(ctx.role);
  await revokeFleet(ctx.accountId, userId, fleetId);
  revalidatePath('/settings/users');
}
