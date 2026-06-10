'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { Machine } from '@/lib/types';
import { assetInitials, brandColors } from '@/lib/format';
import { StatusBadge } from '@/components/StatusBadge';
import { AlertsBadge } from '@/components/AlertsBadge';
import { formatKm } from '@/lib/geo';

/** Mobile-tuned machine card: big touch target, single column, optional
 *  distance badge ("3 km") when "Nearest first" mode is on and we have a
 *  user position. */
export function MobileMachineCard({
  machine,
  siteName,
  distanceKm,
}: {
  machine: Machine;
  siteName: string | null;
  distanceKm: number | null;
}) {
  const snap = machine.lastSnapshot;
  const imageUrl = snap?.imageUrl ?? null;
  const activity = snap?.activity ?? null;
  const subtitle = [machine.brand, machine.model, snap?.assetType && snap.assetType !== 'MACHINE' ? snap.assetType : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <Link
      href={`/m/machine/${machine.id}`}
      className="flex items-center gap-3 rounded-2xl bg-white border border-slate-200 px-3 py-3 active:bg-slate-50"
    >
      <Thumb machine={machine} imageUrl={imageUrl} />
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-slate-900 truncate">{machine.name}</div>
        {subtitle && (
          <div className="text-xs text-slate-500 truncate mt-0.5">{subtitle}</div>
        )}
        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
          {activity && <StatusBadge activity={activity} />}
          {snap?.attention && <AlertsBadge attention={snap.attention} size="sm" />}
          {siteName && (
            <span className="inline-flex items-center text-[11px] text-slate-500">
              <svg className="w-3 h-3 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {siteName}
            </span>
          )}
          {distanceKm !== null && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-50 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
              {formatKm(distanceKm)}
            </span>
          )}
        </div>
      </div>
      <svg className="w-4 h-4 text-slate-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}

function Thumb({ machine, imageUrl }: { machine: Machine; imageUrl: string | null }) {
  if (imageUrl) {
    return (
      <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0">
        <Image src={imageUrl} alt={machine.name} fill className="object-cover" sizes="56px" />
      </div>
    );
  }
  const [bg, fg] = brandColors(machine.brand);
  const initials = assetInitials(machine.brand ?? machine.name);
  return (
    <div className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 ${bg}`}>
      <span className={`text-sm font-bold ${fg}`}>{initials}</span>
    </div>
  );
}
