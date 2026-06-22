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
  // Initial snap: 'bar' when already checked in (so the persistent pill is
  // visible immediately), otherwise 'closed' (sheet hidden until a marker
  // is tapped).
  const [snap, setSnap] = useState<SheetSnap>(checkInState ? 'bar' : 'closed');

  // When checked-in state appears, ensure the sheet drops to bar (so the
  // user sees their active machine) if it was previously closed.
  useEffect(() => {
    if (checkInState && snap === 'closed') setSnap('bar');
    if (!checkInState && snap === 'bar') setSnap('closed');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkInState?.machineId]);

  // When the user checks in to the currently selected machine, auto-expand
  // the sheet so the full machine home is immediately useful. We only fire
  // on the transition.
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

  // /m?openMachine=<id> — the cross-tab CheckInBar uses this to ask us to
  // open the sheet for a specific machine. We honour it once, then strip
  // the param so a later page refresh doesn't keep reopening.
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
    return withCoords
      .map((x) => ({ ...x, distanceKm: null as number | null }))
      .sort((a, b) => a.machine.name.localeCompare(b.machine.name))
      .slice(0, NEARBY_LIMIT);
  }, [machines, geo.position]);

  // The sheet should ALWAYS show the checked-in machine when one exists,
  // even if the user hasn't tapped a marker yet (e.g. they navigated here
  // from another tab via the bar).
  const effectiveSelectedId = selectedId ?? checkInState?.machineId ?? null;

  const selected = useMemo(() => {
    if (!effectiveSelectedId) return null;
    const machine = machines.find((m) => m.id === effectiveSelectedId);
    if (!machine) return null;
    const inNearby = nearby.find((n) => n.machine.id === effectiveSelectedId);
    return { machine, distanceKm: inNearby?.distanceKm ?? null };
  }, [machines, nearby, effectiveSelectedId]);

  // Available snap points depend on context: if checked in, 'bar' replaces
  // 'closed' as the minimum (sheet can never be fully dismissed while
  // checked in). If not checked in, 'bar' is unreachable.
  const availableSnaps: SheetSnap[] = checkInState
    ? (['bar', 'peek', 'expanded'] as SheetSnap[])
    : (['closed', 'peek', 'expanded'] as SheetSnap[]);

  function openMachine(id: string) {
    setSelectedId(id);
    setSnap('peek');
  }

  const isCheckedInHere = !!(
    selected && checkInState?.machineId === selected.machine.id
  );

  return (
    <>
      {/* isolation:isolate gives the map its own stacking context so Leaflet's
          internal z-indexes (attribution at z-800, controls at z-1000, etc.)
          stay scoped here and don't bleed above the bottom sheet (z-50). */}
      <div
        className="relative w-full"
        style={{ height: 'calc(100vh - 110px)', isolation: 'isolate' }}
      >
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
          selectedId={effectiveSelectedId}
          onMarkerClick={openMachine}
        />

        {geo.status === 'denied' && (
          <div className="absolute bottom-3 left-3 right-3 z-10 rounded-lg bg-white border border-rose-200 px-3 py-2 text-xs text-rose-700 text-center shadow">
            Location permission is needed to find the nearest machines. Enable it in your
            browser settings and tap Locate me.
          </div>
        )}
      </div>

      <MachineSheet
        snap={snap}
        onSnapChange={setSnap}
        availableSnaps={availableSnaps}
        barContent={
          isCheckedInHere && checkInState ? (
            <SheetCheckInBar
              machineName={checkInState.machineName}
              startedAt={checkInState.startedAt}
              onCheckOut={checkOut}
              onTap={() => setSnap('expanded')}
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

/** Bar-state content: rendered inside the sheet at the bottom edge whenever
 *  the operator is checked in. Tapping the row (anywhere except the Check
 *  out button) expands the sheet to reveal the full machine home. */
function SheetCheckInBar({
  machineName,
  startedAt,
  onCheckOut,
  onTap,
}: {
  machineName: string;
  startedAt: string;
  onCheckOut: () => void;
  onTap: () => void;
}) {
  const elapsed = useElapsed(startedAt);
  return (
    <div className="px-4 py-3 flex items-center gap-3 h-full">
      <button
        type="button"
        onClick={onTap}
        className="flex items-center gap-3 flex-1 min-w-0 text-left"
      >
        <span className="relative inline-flex h-2.5 w-2.5 flex-shrink-0">
          <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75 animate-ping" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-200" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-wide opacity-80 font-semibold">
            Checked in
          </div>
          <div className="text-sm font-semibold truncate">{machineName}</div>
        </div>
        <div className="font-mono text-sm tabular-nums opacity-90">{elapsed}</div>
      </button>
      <button
        type="button"
        onClick={onCheckOut}
        className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 active:bg-white/25 text-xs font-semibold"
      >
        Check out
      </button>
    </div>
  );
}
