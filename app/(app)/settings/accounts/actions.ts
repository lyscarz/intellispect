'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getSessionContext } from '@/lib/getSessionContext';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createDefaultFleetForAccount } from '@/lib/fleets';

const ACTIVE_ACCOUNT_COOKIE = 'active_account_id';

export async function createAccountAction(name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Account name is required');

  const ctx = await getSessionContext();
  const admin = createSupabaseAdminClient();

  const { data: account, error: accErr } = await admin
    .from('accounts')
    .insert({ name: trimmed, created_by: ctx.userId })
    .select('id, name')
    .single();
  if (accErr || !account) throw new Error(`Failed to create account: ${accErr?.message}`);

  const { error: memErr } = await admin
    .from('account_members')
    .insert({ account_id: account.id, user_id: ctx.userId, role: 'account_admin' });
  if (memErr) throw new Error(`Failed to attach owner: ${memErr.message}`);

  // Default fleet so the new account isn't empty.
  try {
    await createDefaultFleetForAccount(account.id as string, ctx.userId);
  } catch (e) {
    // Non-fatal — the account still exists.
    console.error('[createAccountAction] default fleet failed:', (e as Error).message);
  }

  // Switch the cookie so the next request lands in the new account.
  cookies().set(ACTIVE_ACCOUNT_COOKIE, account.id as string, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  revalidatePath('/settings/accounts');
  revalidatePath('/fleet');
  redirect('/fleet');
}
