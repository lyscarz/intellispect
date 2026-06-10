'use client';

import { useEffect } from 'react';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Machine } from '@/lib/types';

interface Pin {
  machine: Machine;
  coords: { lat: number; lng: number };
  distanceKm: number | null;
}

const machineIcon = L.divIcon({
  html: `
    <div style="width:30px;height:30px;border-radius:50%;background:#0f172a;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35);">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
    </div>
  `,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
  className: '',
});

const machineIconSelected = L.divIcon({
  html: `
    <div style="width:36px;height:36px;border-radius:50%;background:#f59e0b;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.45);">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
    </div>
  `,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  className: '',
});

const userIcon = L.divIcon({
  html: `
    <div style="position:relative;width:22px;height:22px;">
      <div style="position:absolute;inset:0;border-radius:50%;background:#3b82f6;opacity:0.4;animation:pulse 2s infinite;"></div>
      <div style="position:absolute;left:5px;top:5px;width:12px;height:12px;border-radius:50%;background:#2563eb;border:2.5px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.35);"></div>
    </div>
  `,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  className: '',
});

function CenterAndFit({
  userPosition,
  pins,
}: {
  userPosition: { lat: number; lng: number } | null;
  pins: Pin[];
}) {
  const map = useMap();
  useEffect(() => {
    const positions: [number, number][] = pins.map((p) => [p.coords.lat, p.coords.lng]);
    if (userPosition) positions.push([userPosition.lat, userPosition.lng]);
    if (positions.length === 0) return;
    if (positions.length === 1) {
      map.setView(positions[0], 15);
    } else {
      map.fitBounds(positions, { padding: [60, 60], maxZoom: 15 });
    }
  }, [pins, userPosition, map]);
  return null;
}

export function NearbyMap({
  userPosition,
  pins,
  selectedId,
  onMarkerClick,
}: {
  userPosition: { lat: number; lng: number } | null;
  pins: Pin[];
  selectedId: string | null;
  onMarkerClick: (id: string) => void;
}) {
  const initialCenter: [number, number] = userPosition
    ? [userPosition.lat, userPosition.lng]
    : pins[0]
      ? [pins[0].coords.lat, pins[0].coords.lng]
      : [51.5074, -0.1278]; // London fallback so the map doesn't blank

  return (
    <MapContainer
      center={initialCenter}
      zoom={13}
      style={{ height: '100%', width: '100%' }}
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <CenterAndFit userPosition={userPosition} pins={pins} />
      {userPosition && (
        <Marker
          position={[userPosition.lat, userPosition.lng]}
          icon={userIcon}
        />
      )}
      {pins.map((p) => (
        <Marker
          key={p.machine.id}
          position={[p.coords.lat, p.coords.lng]}
          icon={p.machine.id === selectedId ? machineIconSelected : machineIcon}
          eventHandlers={{
            click: () => onMarkerClick(p.machine.id),
          }}
        />
      ))}
    </MapContainer>
  );
}
