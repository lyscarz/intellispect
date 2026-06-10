import Link from 'next/link';
import { getSessionContext } from '@/lib/getSessionContext';
import { listMachinesForAccount } from '@/lib/machines';
import { getSignedImageUrls } from '@/lib/storage';
import { getActiveConnection } from '@/lib/telematics/connections';
import { countMachinesByFleet, listFleetsForAccount } from '@/lib/fleets';
import { listSitesForAccount } from '@/lib/sites';
import { FleetTabs } from '@/components/FleetTabs';
import { FleetList, type FleetRow } from './FleetList';

export const dynamic = 'force-dynamic';

export default async function FleetPage({
  searchParams,
}: {
  searchParams: { fleet?: string };
}) {
  const ctx = await getSessionContext();
  const [machines, connection, fleets, fleetCounts, sites] = await Promise.all([
    listMachinesForAccount(ctx.accountId, ctx.allowedFleetIds),
    getActiveConnection(ctx.accountId, 'trackunit'),
    listFleetsForAccount(ctx.accountId),
    countMachinesByFleet(ctx.accountId),
    listSitesForAccount(ctx.accountId, ctx.allowedFleetIds),
  ]);
  const sitesById: Record<string, string> = Object.fromEntries(sites.map((s) => [s.id, s.name]));

  // Build counts keyed by fleetId (and 'unassigned' for null bucket).
  const countsForTabs: Record<string, number> = {};
  for (const c of fleetCounts) {
    countsForTabs[c.fleetId ?? 'unassigned'] = c.count;
  }

  // Resolve active fleet from URL.
  const fleetSlug = searchParams.fleet ?? null;
  let activeSlug: string | null = null;
  let activeFleetId: string | null = null;
  let isUnassigned = false;

  if (fleetSlug === 'unassigned') {
    activeSlug = 'unassigned';
    isUnassigned = true;
  } else if (fleetSlug) {
    const match = fleets.find((f) => f.slug === fleetSlug);
    if (match) {
      activeSlug = match.slug;
      activeFleetId = match.id;
    }
  }
  // Default = first fleet, or 'unassigned' if none + there's unassigned content.
  if (activeSlug === null) {
    if (fleets.length > 0) {
      activeSlug = fleets[0].slug;
      activeFleetId = fleets[0].id;
    } else if ((countsForTabs['unassigned'] ?? 0) > 0) {
      activeSlug = 'unassigned';
      isUnassigned = true;
    }
  }

  // Filter machines for the active tab.
  const filteredMachines = isUnassigned
    ? machines.filter((m) => m.fleetId == null)
    : activeFleetId
      ? machines.filter((m) => m.fleetId === activeFleetId)
      : machines;

  const signedUrls = await getSignedImageUrls(filteredMachines.map((m) => m.imagePath));
  const rows: FleetRow[] = filteredMachines.map((m, i) => ({ machine: m, imageUrl: signedUrls[i] }));

  const trackunitCta = connection
    ? { label: 'Add Trackunit machines', href: '/fleet/connect' }
    : { label: 'Connect Trackunit', href: '/settings/connections' };

  const activeFleetName =
    activeSlug === 'unassigned'
      ? 'Unassigned'
      : fleets.find((f) => f.slug === activeSlug)?.name ?? 'My Fleet';

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Fleets &amp; Machines</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {ctx.accountName} · {activeFleetName} · {rows.length} machine{rows.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={trackunitCta.href}
            className="inline-flex items-center gap-1.5 rounded-lg ring-1 ring-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm font-medium px-3 py-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            {trackunitCta.label}
          </Link>
          <Link
            href="/fleet/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-3 py-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add machine
          </Link>
        </div>
      </div>

      <div className="mb-5">
        <FleetTabs
          fleets={fleets}
          counts={countsForTabs}
          activeSlug={activeSlug}
          urlBase="/fleet"
        />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-20 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="mt-4 font-semibold text-slate-900">
            {isUnassigned ? 'No unassigned machines' : `No machines in ${activeFleetName}`}
          </h3>
          <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
            Add a machine manually, or import them from your Trackunit account in bulk.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link href={trackunitCta.href} className="text-sm font-medium text-brand-600 hover:text-brand-700">
              {trackunitCta.label} →
            </Link>
            <span className="text-slate-300">·</span>
            <Link href="/fleet/new" className="text-sm font-medium text-slate-600 hover:text-slate-900">
              Add manually
            </Link>
          </div>
        </div>
      ) : (
        <FleetList rows={rows} sitesById={sitesById} fleets={fleets} sites={sites} />
      )}
    </div>
  );
}
