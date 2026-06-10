import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ACTIVE_ACCOUNT_COOKIE = 'active_account_id';

interface Body {
  accountId: string;
}

export async function POST(req: NextRequest) {
  const { accountId } = (await req.json()) as Body;
  if (!accountId) {
    return NextResponse.json({ error: 'accountId required' }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify the caller is actually a member of this account (admin client so we
  // see across accounts).
  const admin = createSupabaseAdminClient();
  const { data: membership, error } = await admin
    .from('account_members')
    .select('account_id')
    .eq('account_id', accountId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

  cookies().set(ACTIVE_ACCOUNT_COOKIE, accountId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  return new NextResponse(null, { status: 204 });
}
