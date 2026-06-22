'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Machine, Site } from '@/lib/types';
import { useGeolocation } from '@/lib/use-geolocation';
import { haversineKm, formatKm } from '@/lib/geo';
import { useCheckIn, useElapsed } from '@/lib/use-check-in';
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const { state: checkInState, checkOut } = useCheckIn();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [snap, setSnap] = useState<SheetSnap>('closed');

  // When the user checks in to the currently selected machine, auto-expand
  // the sheet so the pinned check-out + scrollable details are immediately
  // useful. We only fire on the transition, not every render.
  useEffect(() => {
    if (
      checkInState &&
      selectedId &&
      checkInState.machineId === selectedId &&
      snap !== 'expanded'
    ) {
      setSnap('expanded');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkInState?.machineId, selectedId]);

  // /m?openMachine=<id> — the CheckInBar (and any other deep link) uses this
  // to ask us to open the sheet for a specific machine. We honour it once,
  // then strip the param so a later page refresh doesn't keep reopening.
  const openParam = searchParams.get('openMachine');
  useEffect(() => {
    if (!openParam) return;
    setSelectedId(openParam);
    setSnap('expanded');
    router.replace('/m');
  }, [openParam, router]);

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

  // Resolve the selected machine from the FULL list (not just nearby), so
  // tapping the green CheckInBar from another tab can re-open the sheet even
  // if the checked-in machine isn't in the top-10-nearest. Distance comes
  // from `nearby` when present, otherwise null.
  const selected = useMemo(() => {
    if (!selectedId) return null;
    const machine = machines.find((m) => m.id === selectedId);
    if (!machine) return null;
    const inNearby = nearby.find((n) => n.machine.id === selectedId);
    return { machine, distanceKm: inNearby?.distanceKm ?? null };
  }, [machines, nearby, selectedId]);

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
      <MachineSheet
        snap={snap}
        onSnapChange={setSnap}
        footer={
          selected && checkInState?.machineId === selected.machine.id ? (
            <SheetCheckOutFooter
              startedAt={checkInState.startedAt}
              onCheckOut={checkOut}
            />
          ) : null
        }
      >
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

/** Renders pinned at the bottom of the sheet whenever the user is checked
 *  in to the currently-displayed machine. The machine home above stays
 *  scrollable so the operator can browse issues, telematics, inspections. */
function SheetCheckOutFooter({
  startedAt,
  onCheckOut,
}: {
  startedAt: string;
  onCheckOut: () => void;
}) {
  const elapsed = useElapsed(startedAt);
  return (
    <div className="px-4 py-3 flex items-center gap-3">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="relative inline-flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
        </span>
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">
            Session
          </div>
          <div className="font-mono text-sm tabular-nums font-semibold text-slate-900">
            {elapsed}
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={onCheckOut}
        className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-700 text-white text-sm font-semibold"
      >
        Check out
      </button>
    </div>
  );
}
