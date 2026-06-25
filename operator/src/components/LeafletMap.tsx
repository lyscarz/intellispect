import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { FleetMachine } from '../types';
import { activityOf } from '../lib/format';
import { haversineKm } from '../lib/geo';

// How many of the closest machines to frame around the user's location.
const NEAREST_TO_FIT = 10;
// Re-centre this long after the user last moved the map.
const IDLE_RECENTER_MS = 5000;
// Smallest half-span (deg) so we don't zoom in absurdly when machines are very close.
const MIN_SPAN_DEG = 0.01;

interface Props {
  machines: FleetMachine[];
  userPosition: [number, number] | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function machineIcon(color: string, selected: boolean) {
  const size = selected ? 34 : 24;
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

const userIcon = L.divIcon({
  className: '',
  html: `<div class="op-user-dot"><span class="op-user-pulse"></span></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

export default function LeafletMap({ machines, userPosition, selectedId, onSelect }: Props) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const userMarkerRef = useRef<L.Marker | null>(null);
  const fittedRef = useRef(false);
  const lastFitPosRef = useRef<string | null>(null);

  // Latest props, so the once-registered map handlers always see fresh values.
  const machinesRef = useRef(machines);
  const userPosRef = useRef(userPosition);
  machinesRef.current = machines;
  userPosRef.current = userPosition;

  const programmaticRef = useRef(false);
  const progResetRef = useRef<number | undefined>(undefined);
  const idleTimerRef = useRef<number | undefined>(undefined);

  // Centre the map on the user and size it to include the nearest N machines.
  const recenterRef = useRef<() => void>(() => {});
  recenterRef.current = () => {
    const map = mapRef.current;
    const pos = userPosRef.current;
    if (!map || !pos) return;

    const nearest = machinesRef.current
      .map((m) => {
        const c = m.location?.coordinates;
        return c ? ([c[1], c[0]] as [number, number]) : null;
      })
      .filter((p): p is [number, number] => p !== null)
      .sort((a, b) => haversineKm(pos, a) - haversineKm(pos, b))
      .slice(0, NEAREST_TO_FIT);

    // Symmetric span around the user → user ends up dead-centre, and the span
    // is just large enough to reach the farthest of the nearest N machines.
    let dLat = MIN_SPAN_DEG;
    let dLng = MIN_SPAN_DEG;
    nearest.forEach(([lat, lng]) => {
      dLat = Math.max(dLat, Math.abs(lat - pos[0]));
      dLng = Math.max(dLng, Math.abs(lng - pos[1]));
    });
    const bounds = L.latLngBounds(
      [pos[0] - dLat, pos[1] - dLng],
      [pos[0] + dLat, pos[1] + dLng]
    );

    programmaticRef.current = true;
    window.clearTimeout(progResetRef.current);
    progResetRef.current = window.setTimeout(() => {
      programmaticRef.current = false;
    }, 700);
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
  };

  // Init the map once.
  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    const map = L.map(elRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView([56.156, 10.203], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;

    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(elRef.current);
    window.setTimeout(() => map.invalidateSize(), 200);

    // Auto-recentre after the user stops interacting with the map (only when we
    // actually have a location). Our own fitBounds calls set programmaticRef so
    // they don't count as "user moved".
    const onMoveStart = () => {
      if (programmaticRef.current) return;
      window.clearTimeout(idleTimerRef.current);
    };
    const onMoveEnd = () => {
      if (programmaticRef.current) return;
      if (!userPosRef.current) return;
      window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = window.setTimeout(() => recenterRef.current(), IDLE_RECENTER_MS);
    };
    map.on('movestart', onMoveStart);
    map.on('moveend', onMoveEnd);

    return () => {
      ro.disconnect();
      window.clearTimeout(idleTimerRef.current);
      window.clearTimeout(progResetRef.current);
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
      userMarkerRef.current = null;
    };
  }, []);

  // Sync machine markers.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set<string>();
    const bounds: L.LatLngExpression[] = [];

    machines.forEach((m) => {
      const c = m.location?.coordinates;
      if (!c) return;
      const latlng: [number, number] = [c[1], c[0]];
      seen.add(m.assetId);
      bounds.push(latlng);
      const color = activityOf(m.activity).color;
      const existing = markersRef.current.get(m.assetId);
      if (existing) {
        existing.setLatLng(latlng);
        existing.setIcon(machineIcon(color, m.assetId === selectedId));
      } else {
        const mk = L.marker(latlng, {
          icon: machineIcon(color, m.assetId === selectedId),
        }).addTo(map);
        mk.on('click', () => onSelect(m.assetId));
        markersRef.current.set(m.assetId, mk);
      }
    });

    markersRef.current.forEach((mk, id) => {
      if (!seen.has(id)) {
        mk.remove();
        markersRef.current.delete(id);
      }
    });

    // Pre-location fallback: frame the whole fleet until we have the user.
    if (!fittedRef.current && bounds.length && !userPosition) {
      programmaticRef.current = true;
      window.clearTimeout(progResetRef.current);
      progResetRef.current = window.setTimeout(() => {
        programmaticRef.current = false;
      }, 700);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
      fittedRef.current = true;
    }
  }, [machines, selectedId, onSelect, userPosition]);

  // User position marker + recentre when the position first arrives / changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userPosition) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng(userPosition);
    } else {
      userMarkerRef.current = L.marker(userPosition, {
        icon: userIcon,
        zIndexOffset: 1000,
      }).addTo(map);
    }

    const posKey = `${userPosition[0].toFixed(5)},${userPosition[1].toFixed(5)}`;
    if (lastFitPosRef.current === posKey) return;
    lastFitPosRef.current = posKey;
    recenterRef.current();
  }, [userPosition, machines]);

  // Pan to the selected machine.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId) return;
    const m = machines.find((x) => x.assetId === selectedId);
    const c = m?.location?.coordinates;
    if (c) {
      programmaticRef.current = true;
      window.clearTimeout(progResetRef.current);
      progResetRef.current = window.setTimeout(() => {
        programmaticRef.current = false;
      }, 700);
      map.panTo([c[1], c[0]]);
    }
  }, [selectedId, machines]);

  return <div ref={elRef} className="op-map" />;
}
