import Link from 'next/link';
import { getSessionContext } from '@/lib/getSessionContext';
import { AdminRefreshButton } from './AdminRefreshButton';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const ctx = await getSessionContext();

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold text-slate-900">Settings</h1>
      <p className="text-sm text-slate-500 mt-0.5">Account: {ctx.accountName}</p>

      <div className="mt-8 space-y-3">
        <Link
          href="/settings/fleets"
          className="block rounded-xl ring-1 ring-slate-200 bg-white px-4 py-4 hover:bg-slate-50"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-slate-900">Fleets</h3>
              <p className="text-sm text-slate-500 mt-0.5">
                Group machines into regional or operational fleets.
              </p>
            </div>
            <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>
        <Link
          href="/settings/connections"
          className="block rounded-xl ring-1 ring-slate-200 bg-white px-4 py-4 hover:bg-slate-50"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-slate-900">Telematics connections</h3>
              <p className="text-sm text-slate-500 mt-0.5">
                Connect your Trackunit account to import machines.
              </p>
            </div>
            <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>

        {ctx.role === 'account_admin' && (
          <Link
            href="/settings/users"
            className="block rounded-xl ring-1 ring-slate-200 bg-white px-4 py-4 hover:bg-slate-50"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-slate-900">Users</h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  Invite admins and operators, manage roles, and scope access by fleet.
                </p>
              </div>
              <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        )}

        <Link
          href="/settings/accounts"
          className="block rounded-xl ring-1 ring-slate-200 bg-white px-4 py-4 hover:bg-slate-50"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-slate-900">Your accounts</h3>
              <p className="text-sm text-slate-500 mt-0.5">
                Switch between accounts you belong to, or create a new one.
              </p>
            </div>
            <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>
      </div>

      <h2 className="mt-10 text-sm font-semibold text-slate-900 uppercase tracking-wide">Admin</h2>
      <div className="mt-3 rounded-xl ring-1 ring-slate-200 bg-white px-4 py-4">
        <h3 className="font-medium text-slate-900">Manual fleet refresh</h3>
        <p className="text-sm text-slate-500 mt-0.5 mb-3">
          A background job refreshes every Trackunit machine&apos;s snapshot every 30 minutes.
          Use this to trigger an ad-hoc refresh in between.
        </p>
        <AdminRefreshButton />
      </div>
    </div>
  );
}
