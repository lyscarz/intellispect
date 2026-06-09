import { getSessionContext } from '@/lib/getSessionContext';
import { listMachinesForAccount } from '@/lib/machines';
import { listSitesForAccount } from '@/lib/sites';
import { MobileMachineList } from './MobileMachineList';

export const dynamic = 'force-dynamic';

export default async function MobileLanding() {
  const ctx = await getSessionContext();
  const [machines, sites] = await Promise.all([
    listMachinesForAccount(ctx.accountId),
    listSitesForAccount(ctx.accountId),
  ]);

  return (
    <div className="px-4 py-3 max-w-screen-sm mx-auto">
      <header className="mb-3">
        <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold">
          {ctx.accountName}
        </div>
        <h1 className="text-xl font-bold">Pick a machine to inspect</h1>
      </header>
      <MobileMachineList machines={machines} sites={sites} />
    </div>
  );
}
