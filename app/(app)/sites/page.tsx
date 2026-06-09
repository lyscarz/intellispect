import { redirect } from 'next/navigation';
import { getSessionContext } from '@/lib/getSessionContext';
import { countMachinesByFleet, listFleetsForAccount } from '@/lib/fleets';
import { listSitesForFleet } from '@/lib/sites';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { FleetTabs } from '@/components/FleetTabs';
import { SitesTable } from './SitesTable';

export const dynamic = 'force-dynamic';

export default async function SitesPage({
  searchParams,
}: {
  searchParams: { fleet?: string };
}) {
  const ctx = await getSessionContext();
  const fleets = await listFleetsForAccount(ctx.accountId);

  if (fleets.length === 0) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-xl font-bold text-slate-900">Sites</h1>
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <h3 className="font-semibold text-slate-900">Create your first fleet to add sites</h3>
          <p className="mt-1 text-sm text-slate-500">
            Sites are scoped per fleet. Add a fleet in{' '}
            <a href="/settings/fleets" className="text-brand-600 hover:text-brand-700 underline">
              Settings → Fleets
            </a>
            .
          </p>
        </div>
      </div>
    );
  }

  // Resolve active fleet — default to the first.
  const requested = searchParams.fleet ?? null;
  const active = requested ? fleets.find((f) => f.slug === requested) ?? fleets[0] : fleets[0];
  if (requested !== active.slug) {
    // Normalize URL so the FleetTabs highlight matches what we render.
    redirect(`/sites?fleet=${encodeURIComponent(active.slug)}`);
  }

  const [sites, fleetCounts] = await Promise.all([
    listSitesForFleet(ctx.accountId, active.id),
    countMachinesByFleet(ctx.accountId),
  ]);
  const countsForTabs: Record<string, number> = {};
  for (const c of fleetCounts) {
    countsForTabs[c.fleetId ?? 'unassigned'] = c.count;
  }

  // Per-site machine counts.
  const supabase = createSupabaseServerClient();
  const { data: siteCounts } = await supabase
    .from('machines')
    .select('site_id')
    .eq('account_id', ctx.accountId)
    .not('site_id', 'is', null);
  const siteCountMap = new Map<string, number>();
  for (const row of siteCounts ?? []) {
    const id = row.site_id as string;
    siteCountMap.set(id, (siteCountMap.get(id) ?? 0) + 1);
  }

  const tableRows = sites.map((s) => ({ ...s, machineCount: siteCountMap.get(s.id) ?? 0 }));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Sites</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {ctx.accountName} · {active.name} · {sites.length} site{sites.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div className="mb-5">
        <FleetTabs fleets={fleets} counts={countsForTabs} activeSlug={active.slug} urlBase="/sites" />
      </div>

      <SitesTable sites={tableRows} fleetId={active.id} />
    </div>
  );
}
