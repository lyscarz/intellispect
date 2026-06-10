'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import type { Machine, Site } from '@/lib/types';
import { useGeolocation } from '@/lib/use-geolocation';
import { haversineKm, formatKm } from '@/lib/geo';
import { MachineSheet, type SheetSnap } from './MachineSheet';
import { MachineHome } from './MachineHome';

const NearbyMap = dynamic(() => import('./NearbyMap').then((m) => m.NearbyMap), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center bg-slate-100 text-sm text-slate-400">
      Loading map…
    </div>
  ),
});

const NEARBY_LIMIT = 10;

export function CheckInTab({
  machines,
  sites,
}: {
  machines: Machine[];
  sites: Site[];
}) {
  const geo = useGeolocation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [snap, setSnap] = useState<SheetSnap>('closed');

  const siteName = useMemo(
    () => Object.fromEntries(sites.map((s) => [s.id, s.name])),
    [sites]
  );

  // Auto-request location on mount — the Check-in tab needs it to function.
  useEffect(() => {
    if (geo.status === 'idle') geo.request();
  }, [geo]);

  // Compute the nearest machines (top N) with coordinates. Falls back to
  // showing whichever machines have coordinates (no distance) if geolocation
  // isn't granted.
  const nearby = useMemo(() => {
    const withCoords = machines
      .map((m) => {
        const c = m.lastSnapshot?.location?.coordinates;
        if (!c) return null;
        return { machine: m, coords: { lat: c[1], lng: c[0] } };
      })
      .filter((x): x is { machine: Machine; coords: { lat: number; lng: number } } => x !== null);

    if (geo.position) {
      const me = geo.position;
      return withCoords
        .map((x) => ({ ...x, distanceKm: haversineKm(me, x.coords) }))
        .sort((a, b) => a.distanceKm - b.distanceKm)
        .slice(0, NEARBY_LIMIT);
    }
    // No location yet — show up to N anyway, alphabetically by name.
    return withCoords
      .map((x) => ({ ...x, distanceKm: null as number | null }))
      .sort((a, b) => a.machine.name.localeCompare(b.machine.name))
      .slice(0, NEARBY_LIMIT);
  }, [machines, geo.position]);

  const selected = useMemo(
    () => nearby.find((n) => n.machine.id === selectedId) ?? null,
    [nearby, selectedId]
  );

  function openMachine(id: string) {
    setSelectedId(id);
    setSnap('peek');
  }

  return (
    <>
      {/* isolation:isolate gives the map its own stacking context so Leaflet's
          internal z-indexes (attribution at z-800, controls at z-1000, etc.)
          stay scoped here and don't bleed above the bottom sheet (z-50). */}
      <div
        className="relative w-full"
        style={{ height: 'calc(100vh - 110px)', isolation: 'isolate' }}
      >
        {/* Top status strip */}
        <div className="absolute top-2 left-2 right-2 z-10 flex items-center justify-between">
          <div className="rounded-full bg-white/95 backdrop-blur px-3 py-1.5 text-xs font-semibold text-slate-700 shadow">
            {geo.status === 'granted'
              ? `${nearby.length} machine${nearby.length === 1 ? '' : 's'} near you`
              : geo.status === 'pending'
                ? 'Finding your location…'
                : geo.status === 'denied'
                  ? 'Location denied'
                  : geo.status === 'unavailable'
                    ? 'Location unavailable'
                    : 'Tap to enable location'}
          </div>
          {geo.status !== 'granted' && (
            <button
              type="button"
              onClick={() => geo.request()}
              className="rounded-full bg-brand-600 text-white px-3 py-1.5 text-xs font-semibold shadow"
            >
              Locate me
            </button>
          )}
        </div>

        <NearbyMap
          userPosition={geo.position}
          pins={nearby}
          selectedId={selectedId}
          onMarkerClick={openMachine}
        />

        {geo.status === 'denied' && (
          <div className="absolute bottom-3 left-3 right-3 z-10 rounded-lg bg-white border border-rose-200 px-3 py-2 text-xs text-rose-700 text-center shadow">
            Location permission is needed to find the nearest machines. Enable it in your
            browser settings and tap Locate me.
          </div>
        )}
      </div>

      {/* Bottom sheet */}
      <MachineSheet snap={snap} onSnapChange={setSnap}>
        {selected ? (
          <MachineHome
            machine={selected.machine}
            distanceLabel={
              selected.distanceKm !== null ? formatKm(selected.distanceKm) : null
            }
            siteName={
              selected.machine.siteId ? siteName[selected.machine.siteId] ?? null : null
            }
          />
        ) : (
          <div className="px-4 py-6 text-sm text-slate-500">No machine selected.</div>
        )}
      </MachineSheet>
    </>
  );
}
