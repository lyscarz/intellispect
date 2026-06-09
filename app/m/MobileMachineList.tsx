'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { Machine, Site } from '@/lib/types';

const ALL_SITES = '__all__';
const NO_SITE = '__none__';

export function MobileMachineList({
  machines,
  sites,
}: {
  machines: Machine[];
  sites: Site[];
}) {
  const [query, setQuery] = useState('');
  const [siteFilter, setSiteFilter] = useState<string>(ALL_SITES);

  const siteName = useMemo(
    () => Object.fromEntries(sites.map((s) => [s.id, s.name])),
    [sites]
  );

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

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return machines
      .filter((m) => {
        if (siteFilter === NO_SITE && m.siteId) return false;
        if (siteFilter !== ALL_SITES && siteFilter !== NO_SITE && m.siteId !== siteFilter) return false;
        if (!q) return true;
        const hay = [m.name, m.brand, m.model, m.lastSnapshot?.assetType, m.serialNumber]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }, [machines, query, siteFilter]);

  return (
    <>
      <div className="sticky top-0 z-10 -mx-4 px-4 pt-1 pb-2 bg-slate-50/90 backdrop-blur">
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
                  active ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 border border-slate-200'
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
      </div>

      <div className="mt-2 grid gap-2">
        {visible.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            No machines match the current filters.
          </div>
        )}
        {visible.map((m) => {
          const subtitle = [m.lastSnapshot?.assetType, m.brand, m.model].filter(Boolean).join(' · ');
          const site = m.siteId ? siteName[m.siteId] ?? null : null;
          return (
            <Link
              key={m.id}
              href={`/m/machine/${m.id}`}
              className="rounded-xl bg-white border border-slate-200 p-3 active:bg-slate-100 transition flex items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{m.name}</div>
                {subtitle && <div className="text-xs text-slate-500 mt-0.5 truncate">{subtitle}</div>}
                <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                  {site ?? m.site ?? 'No site'}
                </div>
              </div>
              <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          );
        })}
      </div>
    </>
  );
}
