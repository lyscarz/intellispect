'use client';

import { useState } from 'react';
import type { Fleet, Site } from '@/lib/types';

interface Props {
  fleets: Fleet[];
  /** Sites grouped by fleet id. Empty array if a fleet has no sites yet. */
  sitesByFleetId: Record<string, Site[]>;
  defaultFleetId?: string | null;
  defaultSiteId?: string | null;
  /** When fleet changes, the previously-selected site is auto-cleared. */
  onFleetChange?: (fleetId: string | null) => void;
}

export function FleetSitePicker({
  fleets,
  sitesByFleetId,
  defaultFleetId = null,
  defaultSiteId = null,
  onFleetChange,
}: Props) {
  const [fleetId, setFleetId] = useState<string | null>(defaultFleetId);
  const [siteId, setSiteId] = useState<string | null>(defaultSiteId);

  const sitesForFleet = fleetId ? sitesByFleetId[fleetId] ?? [] : [];

  function handleFleetChange(next: string | null) {
    setFleetId(next);
    // Changing fleet invalidates site assignment.
    setSiteId(null);
    onFleetChange?.(next);
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-slate-700">Fleet</label>
        <select
          name="fleet_id"
          value={fleetId ?? ''}
          onChange={(e) => handleFleetChange(e.target.value || null)}
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
        <label className="block text-sm font-medium text-slate-700">Site</label>
        <select
          name="site_id"
          value={siteId ?? ''}
          onChange={(e) => setSiteId(e.target.value || null)}
          disabled={!fleetId || sitesForFleet.length === 0}
          className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 disabled:bg-slate-50 disabled:text-slate-400"
        >
          <option value="">{sitesForFleet.length === 0 ? '— No sites in fleet —' : '— None —'}</option>
          {sitesForFleet.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
