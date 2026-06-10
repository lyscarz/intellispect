'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import type { Machine, Site } from '@/lib/types';
import { useGeolocation } from '@/lib/use-geolocation';
import { haversineKm } from '@/lib/geo';
import { MobileMachineCard } from './MobileMachineCard';

const MobileFleetMap = dynamic(() => import('./MobileFleetMap').then((m) => m.MobileFleetMap), {
  ssr: false,
  loading: () => (
    <div className="h-[60vh] rounded-2xl bg-slate-100 flex items-center justify-center text-sm text-slate-400">
      Loading map…
    </div>
  ),
});

const ALL_SITES = '__all__';
const NO_SITE = '__none__';

type View = 'list' | 'map';

export function MobileFleetView({
  machines,
  sites,
}: {
  machines: Machine[];
  sites: Site[];
}) {
  const [query, setQuery] = useState('');
  const [siteFilter, setSiteFilter] = useState<string>(ALL_SITES);
  const [view, setView] = useState<View>('list');
  const [nearestFirst, setNearestFirst] = useState(false);
  const geo = useGeolocation();

  // When the user opts into "Nearest first", fire the geolocation request.
  // If it was already granted, we just keep the existing position.
  useEffect(() => {
    if (nearestFirst && geo.status === 'idle') geo.request();
  }, [nearestFirst, geo]);

  // If geolocation gets denied, undo the nearest-first toggle.
  useEffect(() => {
    if (geo.status === 'denied' || geo.status === 'unavailable') {
      setNearestFirst(false);
    }
  }, [geo.status]);

  const siteName = useMemo(
    () => Object.fromEntries(sites.map((s) => [s.id, s.name])),
    [sites]
  );

  // Tabs derive from sites that actually have a machine in scope.
  const tabs = useMemo(() => {
    const counts = new Map<string, number>();
    let unassigned = 0;
    for (const m of machines) {
      if (m.siteId) counts.set(m.siteId, (counts.get(m.siteId) ?? 0) + 1);
      else unassigned++;
    }
    const siteTabs = sites
      .filter((s) => counts.has(s.id))
      .map((s) => ({ value: s.id, label: s.name, count: counts.get(s.id)! }));
    const out = [{ value: ALL_SITES, label: 'All', count: machines.length }, ...siteTabs];
    if (unassigned > 0) out.push({ value: NO_SITE, label: 'No site', count: unassigned });
    return out;
  }, [machines, sites]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return machines.filter((m) => {
      if (siteFilter === NO_SITE && m.siteId) return false;
      if (siteFilter !== ALL_SITES && siteFilter !== NO_SITE && m.siteId !== siteFilter) {
        return false;
      }
      if (!q) return true;
      const hay = [m.name, m.brand, m.model, m.lastSnapshot?.assetType, m.serialNumber]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [machines, query, siteFilter]);

  // Distance map (machineId → km), only when nearestFirst + position.
  const distances = useMemo(() => {
    if (!nearestFirst || !geo.position) return null;
    const me = geo.position;
    const out: Record<string, number | null> = {};
    for (const m of filtered) {
      const coords = m.lastSnapshot?.location?.coordinates;
      out[m.id] = coords
        ? haversineKm(me, { lat: coords[1], lng: coords[0] })
        : null;
    }
    return out;
  }, [filtered, nearestFirst, geo.position]);

  const visible = useMemo(() => {
    const rows = [...filtered];
    if (nearestFirst && distances) {
      rows.sort((a, b) => {
        const da = distances[a.id];
        const db = distances[b.id];
        // nulls (no location) sink to the bottom
        if (da === null && db === null) return a.name.localeCompare(b.name);
        if (da === null) return 1;
        if (db === null) return -1;
        return da - db;
      });
    } else {
      rows.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    }
    return rows;
  }, [filtered, nearestFirst, distances]);

  return (
    <div>
      {/* Sticky controls header */}
      <div className="sticky top-0 z-10 -mx-4 px-4 pt-1 pb-2 bg-slate-50/95 backdrop-blur">
        <input
          type="search"
          inputMode="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search machines"
          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none"
        />

        <div className="flex items-center gap-1 overflow-x-auto -mx-1 px-1 mt-2 pb-1">
          {tabs.map((t) => {
            const active = t.value === siteFilter;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setSiteFilter(t.value)}
                className={`flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                  active
                    ? 'bg-brand-600 text-white'
                    : 'bg-white text-slate-600 border border-slate-200'
                }`}
              >
                {t.label}
                <span className={`text-[10px] ${active ? 'text-white/80' : 'text-slate-400'}`}>
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-2 flex items-center gap-1.5">
          <Segmented value={view} onChange={setView} />
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => setNearestFirst((v) => !v)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${
              nearestFirst
                ? 'bg-amber-50 border-amber-200 text-amber-800'
                : 'bg-white border-slate-200 text-slate-600'
            }`}
          >
            {geo.status === 'pending' && nearestFirst ? (
              <>
                <Spinner /> Locating…
              </>
            ) : (
              <>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Nearest first
              </>
            )}
          </button>
        </div>

        {geo.status === 'denied' && (
          <div className="mt-1.5 text-[11px] text-rose-600">
            Location denied. Enable in browser settings to sort by distance.
          </div>
        )}
      </div>

      {/* Body */}
      <div className="mt-3">
        {view === 'list' ? (
          visible.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-10 text-center text-sm text-slate-500">
              No machines match.
            </div>
          ) : (
            <div className="space-y-2">
              {visible.map((m) => (
                <MobileMachineCard
                  key={m.id}
                  machine={m}
                  siteName={m.siteId ? siteName[m.siteId] ?? null : null}
                  distanceKm={distances?.[m.id] ?? null}
                />
              ))}
            </div>
          )
        ) : (
          <MobileFleetMap
            machines={visible}
            userPosition={geo.position}
          />
        )}
      </div>
    </div>
  );
}

function Segmented({ value, onChange }: { value: View; onChange: (v: View) => void }) {
  return (
    <div className="inline-flex rounded-full border border-slate-200 bg-white overflow-hidden text-xs font-medium">
      <button
        type="button"
        onClick={() => onChange('list')}
        className={`px-3 py-1 ${value === 'list' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}
      >
        List
      </button>
      <button
        type="button"
        onClick={() => onChange('map')}
        className={`px-3 py-1 ${value === 'map' ? 'bg-slate-900 text-white' : 'text-slate-600'}`}
      >
        Map
      </button>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}
