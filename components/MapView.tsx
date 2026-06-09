'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

// Fix Leaflet's default icon path issue in Next.js by using a DivIcon
const pulseIcon = L.divIcon({
  html: `
    <div style="position:relative;width:22px;height:22px;display:flex;align-items:center;justify-content:center;">
      <div class="marker-pulse" style="position:absolute;width:22px;height:22px;border-radius:50%;background:#3b82f6;opacity:0.35;"></div>
      <div style="width:14px;height:14px;border-radius:50%;background:#2563eb;border:2.5px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35);position:relative;z-index:1;"></div>
    </div>
  `,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  popupAnchor: [0, -12],
  className: '',
});

interface Props {
  lat: number;
  lng: number;
  label: string;
  address: string | null;
}

// Helper component that re-centers the map when coordinates change
function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom(), { animate: true });
  }, [lat, lng, map]);
  return null;
}

export default function MapView({ lat, lng, label, address }: Props) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={14}
      style={{ height: '100%', width: '100%', borderRadius: '0' }}
      zoomControl={true}
      attributionControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Recenter lat={lat} lng={lng} />
      <Marker position={[lat, lng]} icon={pulseIcon}>
        <Popup>
          <div className="font-medium">{label}</div>
          {address && <div className="text-xs text-gray-500 mt-0.5">{address}</div>}
        </Popup>
      </Marker>
    </MapContainer>
  );
}
