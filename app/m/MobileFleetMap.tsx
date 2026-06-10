'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Machine } from '@/lib/types';

// Machine pin — slate dot with brand-blue ring.
const machineIcon = L.divIcon({
  html: `
    <div style="width:18px;height:18px;border-radius:50%;background:#2563eb;border:2.5px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35);"></div>
  `,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  popupAnchor: [0, -10],
  className: '',
});

// User location pin — amber pulse.
const userIcon = L.divIcon({
  html: `
    <div style="position:relative;width:20px;height:20px;display:flex;align-items:center;justify-content:center;">
      <div style="position:absolute;width:20px;height:20px;border-radius:50%;background:#f59e0b;opacity:0.35;"></div>
      <div style="width:10px;height:10px;border-radius:50%;background:#f59e0b;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.35);position:relative;z-index:1;"></div>
    </div>
  `,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  popupAnchor: [0, -10],
  className: '',
});

interface MachineWithCoords {
  machine: Machine;
  coords: [number, number]; // [lat, lng]
}

interface Props {
  machines: Machine[];
  userPosition: { lat: number; lng: number } | null;
}

function FitBounds({
  pins,
  userPosition,
}: {
  pins: MachineWithCoords[];
  userPosition: { lat: number; lng: number } | null;
}) {
  const map = useMap();
  useEffect(() => {
    const positions: [number, number][] = pins.map((p) => p.coords);
    if (userPosition) positions.push([userPosition.lat, userPosition.lng]);
    if (positions.length === 0) return;
    if (positions.length === 1) {
      map.setView(positions[0], 14);
    } else {
      map.fitBounds(positions, { padding: [40, 40], maxZoom: 14 });
    }
  }, [pins, userPosition, map]);
  return null;
}

export function MobileFleetMap({ machines, userPosition }: Props) {
  const router = useRouter();

  const pins: MachineWithCoords[] = useMemo(() => {
    const out: MachineWithCoords[] = [];
    for (const m of machines) {
      const c = m.lastSnapshot?.location?.coordinates;
      if (c && typeof c[0] === 'number' && typeof c[1] === 'number') {
        // Trackunit coordinates are [lng, lat]; Leaflet expects [lat, lng].
        out.push({ machine: m, coords: [c[1], c[0]] });
      }
    }
    return out;
  }, [machines]);

  if (pins.length === 0 && !userPosition) {
    return (
      <div className="h-[60vh] rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-sm text-slate-500 px-6 text-center">
        None of the machines in scope have a known location yet.
      </div>
    );
  }

  // Fallback initial centre — first pin or user position. FitBounds will
  // override on mount.
  const initialCenter: [number, number] = pins[0]?.coords ??
    (userPosition ? [userPosition.lat, userPosition.lng] : [0, 0]);

  return (
    <div className="h-[60vh] rounded-2xl overflow-hidden border border-slate-200">
      <MapContainer
        center={initialCenter}
        zoom={10}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds pins={pins} userPosition={userPosition} />
        {pins.map(({ machine, coords }) => (
          <Marker
            key={machine.id}
            position={coords}
            icon={machineIcon}
            eventHandlers={{
              click: () => router.push(`/m/machine/${machine.id}`),
            }}
          >
            <Popup>
              <div className="font-semibold">{machine.name}</div>
              {(machine.brand || machine.model) && (
                <div className="text-xs text-slate-500 mt-0.5">
                  {[machine.brand, machine.model].filter(Boolean).join(' · ')}
                </div>
              )}
              <button
                type="button"
                onClick={() => router.push(`/m/machine/${machine.id}`)}
                className="mt-2 text-xs font-semibold text-brand-700 hover:underline"
              >
                Open →
              </button>
            </Popup>
          </Marker>
        ))}
        {userPosition && (
          <Marker
            position={[userPosition.lat, userPosition.lng]}
            icon={userIcon}
          >
            <Popup>You</Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
