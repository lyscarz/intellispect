'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Fleet, Site } from '@/lib/types';

interface AssetSummary {
  assetId: string;
  name: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
}

interface SearchResponse {
  assets: AssetSummary[];
  alreadyImportedIds: string[];
  totalCount: number;
  filteredCount: number;
  error?: string;
}

interface Props {
  fleets: Fleet[];
  sitesByFleetId: Record<string, Site[]>;
  defaultFleetId: string | null;
}

export function ConnectPicker({ fleets, sitesByFleetId, defaultFleetId }: Props) {
  const router = useRouter();
  const [allAssets, setAllAssets] = useState<AssetSummary[] | null>(null);
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [targetFleetId, setTargetFleetId] = useState<string | null>(defaultFleetId);
  const [targetSiteId, setTargetSiteId] = useState<string | null>(null);

  const targetFleet = fleets.find((f) => f.id === targetFleetId) ?? null;
  const targetSites = targetFleetId ? sitesByFleetId[targetFleetId] ?? [] : [];

  // Initial fetch — server returns the full unfiltered list. We filter on the client.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch('/api/telematics/trackunit/search')
      .then(async (res) => {
        const json = (await res.json()) as SearchResponse;
        if (cancelled) return;
        if (!res.ok || json.error) {
          setError(json.error ?? 'Failed to load Trackunit assets');
          setLoading(false);
          return;
        }
        setAllAssets(json.assets);
        setImportedIds(new Set(json.alreadyImportedIds));
        setLoading(false);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load Trackunit assets');
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!allAssets) return [];
    const q = query.trim().toLowerCase();
    if (!q) return allAssets;
    return allAssets.filter((a) => {
      const hay = `${a.name} ${a.brand ?? ''} ${a.model ?? ''} ${a.serialNumber ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [allAssets, query]);

  const selectableFiltered = filtered.filter((a) => !importedIds.has(a.assetId));
  const allFilteredSelected =
    selectableFiltered.length > 0 && selectableFiltered.every((a) => selected.has(a.assetId));

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllFiltered() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        for (const a of selectableFiltered) next.delete(a.assetId);
      } else {
        for (const a of selectableFiltered) next.add(a.assetId);
      }
      return next;
    });
  }

  const IMPORT_MAX = 500;
  const overCap = selected.size > IMPORT_MAX;

  async function handleImport() {
    if (selected.size === 0 || importing) return;
    if (overCap) {
      setImportMessage(`Too many selected (${selected.size}). Max per import is ${IMPORT_MAX} — narrow your search and import in batches.`);
      return;
    }
    setImporting(true);
    setImportMessage(null);
    try {
      const res = await fetch('/api/telematics/trackunit/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetIds: Array.from(selected),
          fleetId: targetFleetId,
          siteId: targetSiteId,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setImportMessage(json.error ?? 'Import failed');
        setImporting(false);
        return;
      }
      // Mark as imported in-place for snappy UX, then navigate to /fleet.
      setImportedIds((prev) => new Set([...prev, ...selected]));
      setSelected(new Set());
      setImporting(false);
      startTransition(() => {
        router.push('/fleet');
        router.refresh();
      });
    } catch (err) {
      setImportMessage(err instanceof Error ? err.message : 'Import failed');
      setImporting(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-slate-500 py-12 text-center">Loading Trackunit fleet…</div>;
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div>
      {/* Import-to-fleet panel */}
      {fleets.length > 0 && (
        <div className="mb-4 rounded-xl ring-1 ring-slate-200 bg-white p-4">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Import to</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600">Fleet</label>
              <select
                value={targetFleetId ?? ''}
                onChange={(e) => {
                  const v = e.target.value || null;
                  setTargetFleetId(v);
                  setTargetSiteId(null);
                }}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
              >
                <option value="">— Unassigned —</option>
                {fleets.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600">Default site (optional)</label>
              <select
                value={targetSiteId ?? ''}
                onChange={(e) => setTargetSiteId(e.target.value || null)}
                disabled={!targetFleetId || targetSites.length === 0}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="">{targetSites.length === 0 ? '— No sites in fleet —' : '— None —'}</option>
                {targetSites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by name, brand, model, serial…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
          />
        </div>
        <button
          type="button"
          onClick={toggleAllFiltered}
          disabled={selectableFiltered.length === 0}
          className="rounded-lg ring-1 ring-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium px-3 py-2 disabled:opacity-50"
        >
          {allFilteredSelected ? 'Deselect all' : `Select ${selectableFiltered.length} matching`}
        </button>
      </div>

      <p className="text-xs text-slate-500 mb-3">
        {filtered.length} of {allAssets?.length ?? 0} assets · {selected.size} selected
      </p>

      {importMessage && (
        <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {importMessage}
        </div>
      )}

      <div className="rounded-xl ring-1 ring-slate-200 bg-white max-h-[60vh] overflow-y-auto divide-y divide-slate-100">
        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-500">No matches.</div>
        ) : (
          filtered.map((a) => {
            const imported = importedIds.has(a.assetId);
            const isSelected = selected.has(a.assetId);
            return (
              <label
                key={a.assetId}
                className={`flex items-center gap-3 px-4 py-3 ${
                  imported ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-slate-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  disabled={imported}
                  onChange={() => toggleOne(a.assetId)}
                  className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-600 disabled:opacity-50"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-900 truncate">{a.name}</div>
                  <div className="text-xs text-slate-500 truncate">
                    {[a.brand, a.model, a.serialNumber && `SN ${a.serialNumber}`].filter(Boolean).join(' · ') || '—'}
                  </div>
                </div>
                {imported && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 uppercase tracking-wide">
                    In fleet
                  </span>
                )}
              </label>
            );
          })
        )}
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <a
          href="/fleet"
          className="rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 px-3 py-2"
        >
          Cancel
        </a>
        <button
          type="button"
          onClick={handleImport}
          disabled={selected.size === 0 || importing || pending || overCap}
          className="rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2"
          title={overCap ? `Max ${IMPORT_MAX} per import` : undefined}
        >
          {importing
            ? 'Adding…'
            : `Add ${selected.size} to ${targetFleet ? targetFleet.name : 'Unassigned'}`}
        </button>
      </div>
    </div>
  );
}
