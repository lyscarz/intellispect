import Link from 'next/link';
import { getSessionContext } from '@/lib/getSessionContext';

export const dynamic = 'force-dynamic';

const ROLE_LABEL: Record<string, string> = {
  account_admin: 'Owner',
  admin_user: 'Admin',
  operator: 'Operator',
};

export default async function MobileProfileTab() {
  const ctx = await getSessionContext();
  const canInvite = ctx.role === 'account_admin' || ctx.role === 'admin_user';

  return (
    <div className="px-4 py-4 max-w-screen-sm mx-auto">
      <header className="mb-4">
        <h1 className="text-xl font-bold">Profile</h1>
      </header>

      <section className="rounded-2xl bg-white border border-slate-200 p-4 mb-3">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xl font-bold uppercase">
            {(ctx.email || '?').slice(0, 1)}
          </div>
          <div className="min-w-0">
            <div className="font-semibold truncate">{ctx.email}</div>
            <div className="text-xs text-slate-500 mt-0.5">
              {ROLE_LABEL[ctx.role] ?? ctx.role} · {ctx.accountName}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-2">
        {canInvite && (
          <Link
            href="/m/invite"
            className="flex items-center justify-between rounded-2xl bg-white border border-slate-200 px-4 py-3 active:bg-slate-50"
          >
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 0h6v6h-6v-6z" />
              </svg>
              <div>
                <div className="text-sm font-medium text-slate-900">Invite a teammate</div>
                <div className="text-[11px] text-slate-500">Generate a QR code or shareable link</div>
              </div>
            </div>
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        )}

        <form action="/auth/signout" method="POST">
          <button
            type="submit"
            className="w-full flex items-center justify-between rounded-2xl bg-white border border-slate-200 px-4 py-3 active:bg-slate-50"
          >
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <div className="text-sm font-medium text-rose-600">Sign out</div>
            </div>
          </button>
        </form>
      </section>

      <p className="text-[11px] text-slate-400 text-center mt-6">
        More settings coming here as the app grows.
      </p>
    </div>
  );
}
