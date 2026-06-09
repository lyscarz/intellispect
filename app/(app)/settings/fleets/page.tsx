import Link from 'next/link';
import { getSessionContext } from '@/lib/getSessionContext';
import { countMachinesByFleet, listFleetsForAccount } from '@/lib/fleets';
import { FleetsTable } from './FleetsTable';

export const dynamic = 'force-dynamic';

export default async function FleetsSettingsPage() {
  const ctx = await getSessionContext();
  const [fleets, fleetCounts] = await Promise.all([
    listFleetsForAccount(ctx.accountId),
    countMachinesByFleet(ctx.accountId),
  ]);
  const countsById = new Map<string | null, number>(fleetCounts.map((c) => [c.fleetId, c.count]));

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 mb-6 text-sm text-slate-500">
        <Link href="/settings" className="hover:text-slate-700">Settings</Link>
        <span>/</span>
        <span className="text-slate-900">Fleets</span>
      </div>
      <h1 className="text-xl font-bold text-slate-900">Fleets</h1>
      <p className="text-sm text-slate-500 mt-0.5">
        Group machines into fleets like &ldquo;Denmark&rdquo; or &ldquo;Rental&rdquo;. Sites live inside fleets.
      </p>

      <div className="mt-6">
        <FleetsTable
          fleets={fleets.map((f) => ({
            ...f,
            machineCount: countsById.get(f.id) ?? 0,
          }))}
        />
      </div>
    </div>
  );
}
