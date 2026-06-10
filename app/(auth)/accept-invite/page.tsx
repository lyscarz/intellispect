import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { acceptInvite, getInviteByToken } from '@/lib/invites';

export const dynamic = 'force-dynamic';

const ACTIVE_ACCOUNT_COOKIE = 'active_account_id';

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = searchParams.token?.trim();
  if (!token) {
    return <ErrorCard title="Invalid invite link" body="No token provided." />;
  }

  // Validate the token early so we can surface a helpful error before asking
  // the visitor to sign in.
  const invite = await getInviteByToken(token);
  if (!invite) {
    return (
      <ErrorCard
        title="Invite not found"
        body="This invite has been revoked or never existed. Ask the account owner to send a new one."
      />
    );
  }
  if (invite.acceptedAt) {
    return (
      <ErrorCard
        title="Already accepted"
        body="This invite has already been used. If that wasn't you, please contact the account owner."
        cta={{ href: '/fleet', label: 'Go to your fleet' }}
      />
    );
  }
  if (new Date(invite.expiresAt).getTime() < Date.now()) {
    return (
      <ErrorCard
        title="Invite expired"
        body="This invite is older than 7 days. Ask the account owner to send a fresh one."
      />
    );
  }

  // Fetch the account name for display.
  const admin = createSupabaseAdminClient();
  const { data: account } = await admin
    .from('accounts')
    .select('name')
    .eq('id', invite.accountId)
    .maybeSingle();
  const accountName = (account as { name?: string } | null)?.name ?? 'an account';

  // Are we signed in?
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Not authed yet. Show a friendly card that points at /login with the
    // invite preserved so the user comes right back here after sign-in.
    const nextUrl = `/accept-invite?token=${encodeURIComponent(token)}`;
    return (
      <div className="bg-white rounded-xl ring-1 ring-slate-200 p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">You&apos;ve been invited</h1>
        <p className="mt-1 text-sm text-slate-600">
          <span className="font-medium">{invite.email}</span> has been invited to join{' '}
          <span className="font-semibold">{accountName}</span> as{' '}
          <span className="font-mono text-amber-700">{invite.role.replace('_', ' ')}</span>.
        </p>
        <p className="mt-4 text-sm text-slate-500">
          Sign in (or set your password via the magic link Supabase sent you) and you&apos;ll
          land back on this page to accept the invite.
        </p>
        <Link
          href={`/login?next=${encodeURIComponent(nextUrl)}`}
          className="mt-4 inline-flex w-full justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Sign in to accept
        </Link>
      </div>
    );
  }

  // Sanity-check: the signed-in email must match the invite email (case-insens).
  if ((user.email ?? '').toLowerCase() !== invite.email.toLowerCase()) {
    return (
      <ErrorCard
        title="Wrong account"
        body={`This invite was sent to ${invite.email}, but you're signed in as ${user.email}. Sign out and try again with the right email.`}
        cta={{ href: '/auth/signout', label: 'Sign out' }}
      />
    );
  }

  // All good — accept the invite, switch the active-account cookie, redirect.
  await acceptInvite(token, user.id);

  try {
    cookies().set(ACTIVE_ACCOUNT_COOKIE, invite.accountId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
  } catch {
    // Setting cookies from a server component can throw in older Next runtimes — swallowed.
  }

  redirect('/fleet');
}

function ErrorCard({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta?: { href: string; label: string };
}) {
  return (
    <div className="bg-white rounded-xl ring-1 ring-slate-200 p-6 shadow-sm">
      <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
      <p className="mt-1 text-sm text-slate-600">{body}</p>
      {cta && (
        <Link
          href={cta.href}
          className="mt-4 inline-flex w-full justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          {cta.label}
        </Link>
      )}
    </div>
  );
}
