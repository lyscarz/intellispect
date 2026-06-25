import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { FleetMachine } from '../types';
import { activityOf } from '../lib/format';

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

    // The tab/page may not be sized when the map mounts — recalc on layout.
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(elRef.current);
    window.setTimeout(() => map.invalidateSize(), 200);

    return () => {
      ro.disconnect();
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

    if (!fittedRef.current && bounds.length && !userPosition) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
      fittedRef.current = true;
    }
  }, [machines, selectedId, onSelect, userPosition]);

  // User position marker.
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
    map.setView(userPosition, 12);
  }, [userPosition]);

  // Pan to the selected machine.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId) return;
    const m = machines.find((x) => x.assetId === selectedId);
    const c = m?.location?.coordinates;
    if (c) map.panTo([c[1], c[0]]);
  }, [selectedId, machines]);

  return <div ref={elRef} className="op-map" />;
}
