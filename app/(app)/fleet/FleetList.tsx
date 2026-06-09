'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { Fleet, Machine, Site } from '@/lib/types';
import { assetInitials, brandColors } from '@/lib/format';
import { AlertsBadge } from '@/components/AlertsBadge';
import { bulkAssignToFleetAction, bulkAssignToSiteAction, bulkDisconnectAction } from './actions';

function syncedAgo(iso: string | null): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'just now';
  const min = Math.round(ms / 60_000);
  if (min < 60) return `${min} min ago`;
  const hrs = Math.round(min / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.round(hrs / 24)} d ago`;
}

export interface FleetRow {
  machine: Machine;
  imageUrl: string | null;
}

type SortKey = 'alerts' | 'name' | 'brand' | 'model' | 'type' | 'site' | 'synced' | 'source';
type SortDir = 'asc' | 'desc';

export function FleetList({
  rows,
  sitesById = {},
  fleets = [],
  sites = [],
}: {
  rows: FleetRow[];
  sitesById?: Record<string, string>;
  fleets?: Fleet[];
  sites?: Site[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  function toggleOne(id: string, e?: React.MouseEvent | React.ChangeEvent) {
    e?.stopPropagation();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSort(key: SortKey) {
    if (sortBy === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(key);
      setSortDir('asc');
    }
  }

  function getSortValue(row: FleetRow, key: SortKey): string | number | null {
    const m = row.machine;
    switch (key) {
      case 'alerts': {
        // Rank: CRITICAL > LOW > NONE. Within a bucket, higher count first.
        // Encode into a single number so the generic comparator handles it.
        const a = m.lastSnapshot?.attention;
        if (!a) return 0;
        const rankBase =
          a.criticality === 'CRITICAL' ? 1_000_000 : a.criticality === 'LOW' ? 1_000 : 0;
        const count =
          a.criticality === 'CRITICAL' ? a.criticalEventCount : a.lowEventCount;
        return rankBase + (count ?? 0);
      }
      case 'name':
        return m.name?.toLowerCase() ?? '';
      case 'brand':
        return m.brand?.toLowerCase() ?? null;
      case 'model':
        return m.model?.toLowerCase() ?? null;
      case 'type':
        return m.lastSnapshot?.assetType?.toLowerCase() ?? null;
      case 'site':
        return (m.siteId ? sitesById[m.siteId]?.toLowerCase() : null) ?? m.site?.toLowerCase() ?? null;
      case 'synced':
        return m.lastSyncedAt ? new Date(m.lastSyncedAt).getTime() : null;
      case 'source':
        return m.source;
    }
  }

  function compareForSort(a: FleetRow, b: FleetRow): number {
    const av = getSortValue(a, sortBy);
    const bv = getSortValue(b, sortBy);
    // Nulls always sort to the bottom regardless of direction.
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? rows.filter(({ machine: m }) => {
          const hay = [
            m.name,
            m.brand,
            m.model,
            m.serialNumber,
            m.lastSnapshot?.assetType,
            m.site,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return hay.includes(q);
        })
      : rows;
    return [...filtered].sort(compareForSort);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, query, sortBy, sortDir]);

  function toggleAll() {
    if (selected.size === visible.length) setSelected(new Set());
    else setSelected(new Set(visible.map((r) => r.machine.id)));
  }

  async function handleBulkDisconnect() {
    if (selected.size === 0) return;
    if (!window.confirm(`Disconnect ${selected.size} machine${selected.size === 1 ? '' : 's'}?`)) return;
    setError(null);
    startTransition(async () => {
      try {
        await bulkDisconnectAction(Array.from(selected));
        setSelected(new Set());
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Bulk disconnect failed');
      }
    });
  }

  // Selected rows' shared fleet (or null if mixed/unassigned/etc).
  const selectedRows = rows.filter((r) => selected.has(r.machine.id));
  const selectedFleetIds = new Set(selectedRows.map((r) => r.machine.fleetId));
  const sharedFleetId = selectedFleetIds.size === 1 ? selectedRows[0].machine.fleetId : null;
  const sitesForSelection = sharedFleetId ? sites.filter((s) => s.fleetId === sharedFleetId) : [];

  function handleBulkMoveFleet(fleetId: string | null) {
    if (selected.size === 0) return;
    setError(null);
    startTransition(async () => {
      try {
        await bulkAssignToFleetAction(Array.from(selected), fleetId);
        setSelected(new Set());
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Bulk move failed');
      }
    });
  }

  function handleBulkAssignSite(siteId: string | null) {
    if (selected.size === 0) return;
    setError(null);
    startTransition(async () => {
      try {
        await bulkAssignToSiteAction(Array.from(selected), siteId);
        setSelected(new Set());
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Bulk assign failed');
      }
    });
  }

  const allVisibleSelected = visible.length > 0 && selected.size === visible.length;
  const someSelected = selected.size > 0 && !allVisibleSelected;

  return (
    <div>
      {/* Search */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, brand, model, type, serial…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 bg-white text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
          />
        </div>
        <span className="text-xs text-slate-500">
          {visible.length} of {rows.length} machine{rows.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Bulk bar */}
      {selected.size > 0 && (
        <div className="mb-3 flex items-center justify-between gap-2 rounded-lg ring-1 ring-slate-200 bg-white px-4 py-2.5">
          <span className="text-sm text-slate-700">
            <span className="font-medium">{selected.size}</span> selected
          </span>
          <div className="flex items-center gap-2">
            {fleets.length > 0 && (
              <BulkMenu
                placeholder="Move to fleet…"
                disabled={pending}
                options={[
                  { value: '__null', label: 'Unassign' },
                  ...fleets.map((f) => ({ value: f.id, label: f.name })),
                ]}
                onPick={(v) => handleBulkMoveFleet(v === '__null' ? null : v)}
              />
            )}
            {sharedFleetId !== null && (
              <BulkMenu
                placeholder={
                  sitesForSelection.length === 0 ? 'No sites in fleet' : 'Assign site…'
                }
                disabled={pending || sitesForSelection.length === 0}
                options={[
                  { value: '__null', label: 'Clear site' },
                  ...sitesForSelection.map((s) => ({ value: s.id, label: s.name })),
                ]}
                onPick={(v) => handleBulkAssignSite(v === '__null' ? null : v)}
              />
            )}
            {sharedFleetId === null && selected.size > 1 && (
              <span className="text-xs text-slate-400">
                Mixed fleets — assign site one at a time
              </span>
            )}
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-sm text-slate-500 hover:text-slate-700 px-2 py-1"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={handleBulkDisconnect}
              disabled={pending}
              className="rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium px-3 py-1.5"
            >
              {pending ? 'Working…' : 'Disconnect'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl ring-1 ring-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left w-8">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={toggleAll}
                  className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-600"
                />
              </th>
              <th className="px-2 py-3 text-left w-14"></th>
              <SortHeader label="Name" k="name" current={sortBy} dir={sortDir} onClick={toggleSort} />
              <SortHeader label="Brand" k="brand" current={sortBy} dir={sortDir} onClick={toggleSort} />
              <SortHeader label="Model" k="model" current={sortBy} dir={sortDir} onClick={toggleSort} />
              <SortHeader label="Type" k="type" current={sortBy} dir={sortDir} onClick={toggleSort} />
              <SortHeader label="Alerts" k="alerts" current={sortBy} dir={sortDir} onClick={toggleSort} />
              <SortHeader label="Site" k="site" current={sortBy} dir={sortDir} onClick={toggleSort} />
              <SortHeader label="Synced" k="synced" current={sortBy} dir={sortDir} onClick={toggleSort} />
              <SortHeader label="Source" k="source" current={sortBy} dir={sortDir} onClick={toggleSort} />
              <th className="px-4 py-3 w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-12 text-center text-sm text-slate-500">
                  No matches.
                </td>
              </tr>
            ) : (
              visible.map(({ machine, imageUrl }) => {
                const isSelected = selected.has(machine.id);
                const isDisconnected = machine.status === 'disconnected';
                const synced = syncedAgo(machine.lastSyncedAt);
                const type = machine.lastSnapshot?.assetType ?? null;
                const stale =
                  machine.lastSyncedAt == null ||
                  Date.now() - new Date(machine.lastSyncedAt).getTime() > 60 * 60_000;
                return (
                  <tr
                    key={machine.id}
                    onClick={() => router.push(`/fleet/${machine.id}`)}
                    className={`cursor-pointer hover:bg-slate-50 ${isDisconnected ? 'opacity-60' : ''} ${
                      isSelected ? 'bg-brand-50/40' : ''
                    }`}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => toggleOne(machine.id, e)}
                        className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-600"
                      />
                    </td>
                    <td className="px-2 py-3">
                      <Thumb machine={machine} imageUrl={imageUrl} />
                    </td>
                    <td className="px-2 py-3 font-medium text-slate-900 whitespace-nowrap">
                      <Link href={`/fleet/${machine.id}`} onClick={(e) => e.stopPropagation()} className="hover:text-brand-700">
                        {machine.name}
                      </Link>
                    </td>
                    <td className="px-2 py-3 text-slate-600 whitespace-nowrap">{machine.brand ?? '—'}</td>
                    <td className="px-2 py-3 text-slate-600 whitespace-nowrap">{machine.model ?? '—'}</td>
                    <td className="px-2 py-3 text-slate-600 whitespace-nowrap">
                      {type && type !== 'MACHINE' ? type : '—'}
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap">
                      {machine.lastSnapshot?.attention ? (
                        <AlertsBadge attention={machine.lastSnapshot.attention} />
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-2 py-3 text-slate-600 whitespace-nowrap">
                      {(machine.siteId && sitesById[machine.siteId]) || machine.site || '—'}
                    </td>
                    <td
                      className={`px-2 py-3 whitespace-nowrap text-xs ${stale ? 'text-slate-400' : 'text-slate-500'}`}
                    >
                      {synced}
                    </td>
                    <td className="px-2 py-3 whitespace-nowrap">
                      <SourcePill source={machine.source} disconnected={isDisconnected} />
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BulkMenu({
  placeholder,
  options,
  onPick,
  disabled,
}: {
  placeholder: string;
  options: Array<{ value: string; label: string }>;
  onPick: (value: string) => void;
  disabled?: boolean;
}) {
  const [val, setVal] = useState('__noop');
  return (
    <select
      value={val}
      disabled={disabled}
      onChange={(e) => {
        const v = e.target.value;
        setVal('__noop');
        if (v === '__noop') return;
        onPick(v);
      }}
      className="rounded-lg ring-1 ring-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 text-sm font-medium px-2.5 py-1.5"
    >
      <option value="__noop">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function SortHeader({
  label,
  k,
  current,
  dir,
  onClick,
}: {
  label: string;
  k: SortKey;
  current: SortKey;
  dir: SortDir;
  onClick: (k: SortKey) => void;
}) {
  const active = current === k;
  return (
    <th className="px-2 py-3 text-left whitespace-nowrap">
      <button
        type="button"
        onClick={() => onClick(k)}
        className={`inline-flex items-center gap-1 uppercase tracking-wide ${
          active ? 'text-slate-700' : 'text-slate-500 hover:text-slate-700'
        }`}
      >
        {label}
        <span className="text-[10px]">
          {active ? (dir === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </button>
    </th>
  );
}

function Thumb({ machine, imageUrl }: { machine: Machine; imageUrl: string | null }) {
  const src = imageUrl ?? machine.lastSnapshot?.imageUrl ?? null;
  if (src) {
    return (
      <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-slate-100">
        <Image src={src} alt={machine.name} fill className="object-cover" sizes="40px" />
      </div>
    );
  }
  const [bg, fg] = brandColors(machine.brand);
  const initials = assetInitials(machine.brand ?? machine.name);
  return (
    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${bg}`}>
      <span className={`text-xs font-bold ${fg}`}>{initials}</span>
    </div>
  );
}

function SourcePill({ source, disconnected }: { source: Machine['source']; disconnected: boolean }) {
  const base =
    'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide';
  if (disconnected) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className={`${base} ${source === 'trackunit' ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-600'}`}>
          {source === 'trackunit' ? 'Trackunit' : 'Manual'}
        </span>
        <span className={`${base} bg-amber-100 text-amber-800`}>Disconnected</span>
      </span>
    );
  }
  return (
    <span className={`${base} ${source === 'trackunit' ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-600'}`}>
      {source === 'trackunit' ? 'Trackunit' : 'Manual'}
    </span>
  );
}
