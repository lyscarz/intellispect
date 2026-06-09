import Link from 'next/link';
import { getSessionContext } from '@/lib/getSessionContext';
import { getActiveConnection } from '@/lib/telematics/connections';
import { listFleetsForAccount } from '@/lib/fleets';
import { listSitesForAccount } from '@/lib/sites';
import { ConnectPicker } from './ConnectPicker';
import type { Site } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ConnectPage({
  searchParams,
}: {
  searchParams: { fleet?: string };
}) {
  const ctx = await getSessionContext();
  const [connection, fleets, sites] = await Promise.all([
    getActiveConnection(ctx.accountId, 'trackunit'),
    listFleetsForAccount(ctx.accountId),
    listSitesForAccount(ctx.accountId),
  ]);

  const sitesByFleetId: Record<string, Site[]> = {};
  for (const s of sites) {
    (sitesByFleetId[s.fleetId] ??= []).push(s);
  }

  // Default the import target to the fleet the user came from, or the first.
  const requestedSlug = searchParams.fleet ?? null;
  const defaultFleet = fleets.find((f) => f.slug === requestedSlug) ?? fleets[0] ?? null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-6 text-sm text-slate-500">
        <Link href="/fleet" className="hover:text-slate-700">Fleet</Link>
        <span>/</span>
        <span className="text-slate-900">Connect Trackunit</span>
      </div>

      <h1 className="text-xl font-bold text-slate-900">Connect Trackunit machines</h1>
      <p className="text-sm text-slate-500 mt-0.5">
        Pick machines from your Trackunit account to add to your fleet. Already-imported assets are
        disabled.
      </p>

      {!connection ? (
        <div className="mt-6 rounded-xl ring-1 ring-amber-200 bg-amber-50 p-5">
          <h3 className="font-semibold text-amber-900">Not connected to Trackunit yet</h3>
          <p className="text-sm text-amber-800 mt-1">
            Add your Trackunit credentials before importing machines.
          </p>
          <Link
            href="/settings/connections"
            className="inline-block mt-4 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium px-3 py-2"
          >
            Set up connection →
          </Link>
        </div>
      ) : (
        <div className="mt-6">
          <ConnectPicker
            fleets={fleets}
            sitesByFleetId={sitesByFleetId}
            defaultFleetId={defaultFleet?.id ?? null}
          />
        </div>
      )}
    </div>
  );
}
