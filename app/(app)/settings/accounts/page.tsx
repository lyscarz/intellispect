import Link from 'next/link';
import { getSessionContext } from '@/lib/getSessionContext';
import { CreateAccountButton } from './CreateAccountButton';
import { SwitchAccountButton } from './SwitchAccountButton';

export const dynamic = 'force-dynamic';

const ROLE_LABEL: Record<string, string> = {
  account_admin: 'Owner',
  admin_user: 'Admin',
  operator: 'Operator',
};
const ROLE_CHIP: Record<string, string> = {
  account_admin: 'bg-amber-100 text-amber-800',
  admin_user: 'bg-sky-100 text-sky-700',
  operator: 'bg-slate-100 text-slate-600',
};

export default async function AccountsSettingsPage() {
  const ctx = await getSessionContext();

  return (
    <div className="max-w-3xl">
      <div className="flex items-start justify-between gap-4 mb-2">
        <div>
          <div className="text-sm">
            <Link
              href="/settings"
              className="text-slate-500 hover:text-slate-900 inline-flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Settings
            </Link>
          </div>
          <h1 className="mt-2 text-xl font-bold text-slate-900">Your accounts</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Switch between accounts you&apos;re a member of, or create a brand-new one. API
            integrations (Trackunit, OpenAI, etc.) belong to the account, not to you, so
            each account is fully isolated.
          </p>
        </div>
        <CreateAccountButton />
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white overflow-hidden">
        {ctx.memberships.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-500">No memberships yet.</div>
        ) : (
          <ul>
            {ctx.memberships.map((m, idx) => {
              const isActive = m.accountId === ctx.accountId;
              return (
                <li
                  key={m.accountId}
                  className={`flex items-center justify-between px-4 py-3 ${
                    idx > 0 ? 'border-t border-slate-100' : ''
                  } ${isActive ? 'bg-amber-50/40' : ''}`}
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 truncate">
                      {m.accountName}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${
                          ROLE_CHIP[m.role] ?? 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {ROLE_LABEL[m.role] ?? m.role}
                      </span>
                      {isActive && (
                        <span className="text-[10px] uppercase tracking-wide text-amber-700 font-semibold">
                          Active
                        </span>
                      )}
                    </div>
                  </div>
                  {!isActive && <SwitchAccountButton accountId={m.accountId} />}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
