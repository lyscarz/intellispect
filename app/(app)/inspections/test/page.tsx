import Link from 'next/link';
import { getSessionContext } from '@/lib/getSessionContext';
import { listMachinesForAccount } from '@/lib/machines';
import { listSitesForAccount } from '@/lib/sites';
import { MachineBrowser } from './MachineBrowser';

export const dynamic = 'force-dynamic';

export default async function InspectionsTestPage() {
  const ctx = await getSessionContext();
  const [machines, sites] = await Promise.all([
    listMachinesForAccount(ctx.accountId, ctx.allowedFleetIds),
    listSitesForAccount(ctx.accountId, ctx.allowedFleetIds),
  ]);

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center gap-3 text-sm">
        <Link href="/inspection-history" className="text-slate-500 hover:text-slate-900 inline-flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Inspections
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-bold text-slate-900">Test against a machine</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Pick a machine to see the inspections assigned to it, then run any of them in the phone preview.
        </p>
      </div>

      <MachineBrowser machines={machines} sites={sites} />
    </div>
  );
}
