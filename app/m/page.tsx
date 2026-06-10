import Link from 'next/link';
import { getSessionContext } from '@/lib/getSessionContext';
import { listMachinesForAccount } from '@/lib/machines';
import { listSitesForAccount } from '@/lib/sites';
import { MobileFleetView } from './MobileFleetView';

export const dynamic = 'force-dynamic';

export default async function MobileLanding() {
  const ctx = await getSessionContext();
  const [machines, sites] = await Promise.all([
    listMachinesForAccount(ctx.accountId, ctx.allowedFleetIds),
    listSitesForAccount(ctx.accountId, ctx.allowedFleetIds),
  ]);
  const canInvite = ctx.role === 'account_admin' || ctx.role === 'admin_user';

  return (
    <div className="px-4 py-3 max-w-screen-sm mx-auto">
      <header className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold truncate">
            {ctx.accountName}
          </div>
          <h1 className="text-xl font-bold">My fleet</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {machines.length} machine{machines.length === 1 ? '' : 's'} assigned to you.
          </p>
        </div>
        {canInvite && (
          <Link
            href="/m/invite"
            className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-brand-600 text-white text-xs font-semibold active:bg-brand-700"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 0h6v6h-6v-6z" />
            </svg>
            Invite
          </Link>
        )}
      </header>
      <MobileFleetView machines={machines} sites={sites} />
    </div>
  );
}
