'use client';

import { useMemo, useState } from 'react';
import type { Machine, Site } from '@/lib/types';
import { MachineInspectionsDrawer } from './MachineInspectionsDrawer';

type SortKey = 'name' | 'type' | 'brand' | 'site';
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'type', label: 'Type' },
  { value: 'brand', label: 'Brand' },
  { value: 'site', label: 'Site' },
];

const ALL_SITES_KEY = '__all__';
const NO_SITE_KEY = '__none__';

export function MachineBrowser({ machines, sites }: { machines: Machine[]; sites: Site[] }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('name');
  const [siteFilter, setSiteFilter] = useState<string>(ALL_SITES_KEY);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const siteName = useMemo(
    () => Object.fromEntries(sites.map((s) => [s.id, s.name])),
    [sites]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = machines.filter((m) => {
      // Site filter
      if (siteFilter === NO_SITE_KEY && m.siteId) return false;
      if (siteFilter !== ALL_SITES_KEY && siteFilter !== NO_SITE_KEY && m.siteId !== siteFilter) {
        return false;
      }
      // Text search
      if (!q) return true;
      const hay = [
        m.name,
        m.brand,
        m.model,
        m.lastSnapshot?.assetType,
        m.serialNumber,
        m.siteId ? siteName[m.siteId] : null,
        m.site,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });

    filtered.sort((a, b) => {
      const av = sortValue(a, sort, siteName);
      const bv = sortValue(b, sort, siteName);
      return av.localeCompare(bv, undefined, { sensitivity: 'base' });
    });
    return filtered;
  }, [machines, query, sort, siteFilter, siteName]);

  // Site tabs: All + every site that has at least one machine + unassigned bucket.
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
    const out = [{ value: ALL_SITES_KEY, label: 'All', count: machines.length }, ...siteTabs];
    if (unassigned > 0) out.push({ value: NO_SITE_KEY, label: 'Unassigned', count: unassigned });
    return out;
  }, [machines, sites]);

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[14rem]">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, brand, model, type, serial…"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none text-sm"
            />
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <label className="text-xs text-slate-500 inline-flex items-center gap-1.5">
            Sort by
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="px-2 py-1.5 rounded-lg border border-slate-300 text-sm bg-white"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto -mx-1 px-1 pb-1">
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
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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

      <div className="grid gap-2">
        {visible.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            No machines match the current filters.
          </div>
        )}
        {visible.map((m) => (
          <MachineRow key={m.id} machine={m} siteName={m.siteId ? siteName[m.siteId] ?? null : null} onClick={() => setSelectedId(m.id)} />
        ))}
      </div>

      {selectedId && (
        <MachineInspectionsDrawer
          machineId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </>
  );
}

function sortValue(m: Machine, key: SortKey, siteName: Record<string, string>): string {
  switch (key) {
    case 'name':
      return m.name ?? '';
    case 'type':
      return m.lastSnapshot?.assetType ?? '';
    case 'brand':
      return m.brand ?? '';
    case 'site':
      return m.siteId ? siteName[m.siteId] ?? '' : m.site ?? '';
  }
}

function MachineRow({
  machine,
  siteName,
  onClick,
}: {
  machine: Machine;
  siteName: string | null;
  onClick: () => void;
}) {
  const subtitle = [machine.lastSnapshot?.assetType, machine.brand, machine.model]
    .filter(Boolean)
    .join(' · ');
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left rounded-xl border border-slate-200 bg-white p-3 hover:border-brand-300 hover:shadow-sm transition flex items-center gap-3"
    >
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-slate-900 truncate">{machine.name}</div>
        {subtitle && <div className="text-xs text-slate-500 mt-0.5 truncate">{subtitle}</div>}
        <div className="text-[11px] text-slate-400 mt-0.5 truncate">
          {siteName ?? machine.site ?? 'No site'}
        </div>
      </div>
      <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}
