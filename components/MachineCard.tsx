'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { Asset } from '@/lib/types';
import {
  assetInitials,
  batteryBarColor,
  brandColors,
  formatHours,
  formatLastSeen,
  formatPercent,
  fuelBarColor,
} from '@/lib/format';
import { StatusBadge } from './StatusBadge';
import { TelematicsMetric, Icons } from './TelematicsMetric';
import { LiveLocationModal } from './LiveLocationModal';

function formatAddress(asset: Asset): string | null {
  const a = asset.location?.address;
  if (!a) return null;
  return [a.city, a.country].filter(Boolean).join(', ') || null;
}

export function MachineCard({
  asset,
  source,
  href,
}: {
  asset: Asset;
  source?: 'manual' | 'trackunit';
  href?: string;
}) {
  const [showMap, setShowMap] = useState(false);
  const address = formatAddress(asset);
  const hasLocation = !!asset.location?.coordinates;

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden flex flex-col
        hover:shadow-md hover:ring-slate-300 transition-all duration-200">

        {/* Machine image */}
        <div className="relative w-full aspect-video bg-slate-100 flex-shrink-0">
          {asset.imageUrl ? (
            <Image
              src={asset.imageUrl}
              alt={asset.name}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          ) : (
            (() => {
              const [bg, fg] = brandColors(asset.brand);
              const initials = assetInitials(asset.brand ?? asset.name);
              return (
                <div className={`absolute inset-0 flex flex-col items-center justify-center gap-2 ${bg}`}>
                  <span className={`text-4xl font-bold tracking-tight ${fg}`}>{initials}</span>
                  {asset.model && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full bg-white/60 ${fg}`}>
                      {asset.model}
                    </span>
                  )}
                </div>
              );
            })()
          )}

          {/* Source pill overlay */}
          {source && (
            <div className={`absolute top-2 left-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide
              ${source === 'trackunit' ? 'bg-sky-500/90 text-white' : 'bg-slate-700/90 text-white'}`}>
              {source === 'trackunit' ? 'Trackunit' : 'Manual'}
            </div>
          )}

          {/* Alert badge overlay */}
          {asset.topAlert && asset.topAlert.criticality !== 'NONE' && (
            <div className={`absolute top-2 right-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold
              ${asset.topAlert.criticality === 'CRITICAL'
                ? 'bg-red-500 text-white'
                : 'bg-amber-400 text-amber-900'
              }`}>
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              Alert
            </div>
          )}
        </div>

        {/* Card body */}
        <div className="flex flex-col flex-1 p-4 gap-3">

          {/* Name + status */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-900 truncate text-base leading-tight">
                {href ? <a href={href} className="hover:text-brand-700">{asset.name}</a> : asset.name}
              </h3>
              {(asset.brand || asset.model) && (
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  {[asset.brand, asset.model].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
            <StatusBadge activity={asset.activity} />
          </div>

          {/* Telematics — 2×2 grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 py-3 border-t border-b border-slate-100">
            <TelematicsMetric
              icon={Icons.fuel}
              label="Fuel"
              value={formatPercent(asset.insights.fuelLevel)}
              percent={asset.insights.fuelLevel}
              barColor={fuelBarColor(asset.insights.fuelLevel)}
            />
            <TelematicsMetric
              icon={Icons.battery}
              label="Battery"
              value={formatPercent(asset.insights.batteryStateOfChargePercent)}
              percent={asset.insights.batteryStateOfChargePercent}
              barColor={batteryBarColor(asset.insights.batteryStateOfChargePercent)}
            />
            <TelematicsMetric
              icon={Icons.clock}
              label="Op. Hours"
              value={formatHours(asset.insights.cumulativeOperatingHours)}
            />
            <TelematicsMetric
              icon={Icons.wrench}
              label="Last seen"
              value={formatLastSeen(asset.lastSeen)}
            />
          </div>

          {/* Location + action */}
          <div className="flex items-center justify-between gap-2 mt-auto">
            <div className="flex items-center gap-1.5 min-w-0 text-slate-500">
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-xs truncate">
                {address ?? (hasLocation ? 'Location available' : 'No location')}
              </span>
            </div>
            <button
              onClick={() => setShowMap(true)}
              disabled={!hasLocation}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex-shrink-0
                bg-brand-600 text-white hover:bg-brand-700
                disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                  d="M15 10l4.553-2.069A1 1 0 0121 8.82V18a1 1 0 01-1.447.894L15 17M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
              </svg>
              Live Location
            </button>
          </div>
        </div>
      </div>

      {showMap && (
        <LiveLocationModal asset={asset} onClose={() => setShowMap(false)} />
      )}
    </>
  );
}
