'use client';

import dynamic from 'next/dynamic';
import { NoLocationPanel } from './NoLocationPanel';

const MapView = dynamic(() => import('./MapView'), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center bg-slate-100 text-slate-400 text-sm">
      Loading map…
    </div>
  ),
});

export function MachineHomeMap({
  coords,
  label,
  address,
}: {
  coords: [number, number] | null;
  label: string;
  address: string | null;
}) {
  return (
    <div className="rounded-xl overflow-hidden ring-1 ring-slate-200" style={{ height: '380px' }}>
      {coords ? (
        <MapView lat={coords[1]} lng={coords[0]} label={label} address={address} />
      ) : (
        <NoLocationPanel />
      )}
    </div>
  );
}
