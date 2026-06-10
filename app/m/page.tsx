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

  return (
    <div className="px-4 py-3 max-w-screen-sm mx-auto">
      <header className="mb-3">
        <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">
          {ctx.accountName}
        </div>
        <h1 className="text-xl font-bold">My fleet</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          {machines.length} machine{machines.length === 1 ? '' : 's'} assigned to you.
        </p>
      </header>
      <MobileFleetView machines={machines} sites={sites} />
    </div>
  );
}
