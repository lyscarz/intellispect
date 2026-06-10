'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { Machine } from '@/lib/types';
import { assetInitials, brandColors } from '@/lib/format';
import { StatusBadge } from '@/components/StatusBadge';
import { AlertsBadge } from '@/components/AlertsBadge';
import { useCheckIn } from '@/lib/use-check-in';

/** Content rendered inside the bottom sheet when a machine is picked.
 *  Peek-state design: image + name + brand/model/site + Check-in button +
 *  "view more" hint. Expanded state shows everything below. */
export function MachineHome({
  machine,
  distanceLabel,
  siteName,
}: {
  machine: Machine;
  distanceLabel: string | null;
  siteName: string | null;
}) {
  const { state, checkIn } = useCheckIn();
  const isCheckedInHere = state?.machineId === machine.id;
  const snap = machine.lastSnapshot;
  const imageUrl = snap?.imageUrl ?? null;
  const subtitle = [machine.brand, machine.model, snap?.assetType && snap.assetType !== 'MACHINE' ? snap.assetType : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="px-4 pb-6">
      {/* Peek-state header */}
      <div className="flex items-center gap-3 mb-3">
        <Thumb machine={machine} imageUrl={imageUrl} />
        <div className="flex-1 min-w-0">
          <div className="font-bold text-lg truncate">{machine.name}</div>
          {subtitle && <div className="text-xs text-slate-500 truncate mt-0.5">{subtitle}</div>}
          <div className="text-[11px] text-slate-400 mt-0.5 truncate">
            {siteName ?? machine.site ?? 'No site'}
            {distanceLabel ? ` · ${distanceLabel}` : ''}
          </div>
        </div>
      </div>

      {/* Status chips */}
      <div className="flex items-center gap-1.5 flex-wrap mb-3">
        {snap?.activity && <StatusBadge activity={snap.activity} />}
        {snap?.attention && <AlertsBadge attention={snap.attention} size="sm" />}
      </div>

      {/* Check-in / session info. When the operator IS checked in to THIS
          machine, the sheet's pinned footer (rendered by CheckInTab) handles
          Check out — here we just show context (started at + a hint to scroll). */}
      {isCheckedInHere ? (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2.5 text-sm text-emerald-900">
          <div className="flex items-center gap-2 font-semibold">
            <span className="relative inline-flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Checked in
          </div>
          <div className="text-xs text-emerald-800 mt-1">
            Started {formatStartedAt(state?.startedAt ?? null)}. Browse below — Check out
            stays pinned at the bottom of the sheet.
          </div>
        </div>
      ) : state ? (
        <div className="space-y-2">
          <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
            You&apos;re checked in to <span className="font-semibold">{state.machineName}</span>.
            Check out first before checking in to a different machine.
          </div>
          <button
            type="button"
            disabled
            className="w-full py-3 rounded-xl bg-slate-200 text-slate-500 text-sm font-semibold"
          >
            Check in
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => checkIn({ machineId: machine.id, machineName: machine.name })}
          className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-700 text-white text-sm font-semibold"
        >
          Check in
        </button>
      )}

      {/* Telematics summary */}
      {snap && <TelematicsBlock machine={machine} />}

      {/* Inspections — open the existing picker / runners. */}
      <div className="mt-5">
        <Link
          href={`/m/machine/${machine.id}`}
          className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white border border-slate-300 text-sm font-semibold text-slate-700 active:bg-slate-50"
        >
          Run an inspection
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      {/* Recent events */}
      {snap?.events && snap.events.length > 0 && (
        <div className="mt-5">
          <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-2">
            Active events
          </div>
          <ul className="space-y-1.5">
            {snap.events.slice(0, 5).map((e) => (
              <li
                key={e.id}
                className={`rounded-lg px-3 py-2 text-xs border ${
                  e.severity === 'CRITICAL'
                    ? 'bg-rose-50 border-rose-200 text-rose-800'
                    : e.severity === 'LOW'
                      ? 'bg-amber-50 border-amber-200 text-amber-800'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <div className="font-medium">{e.type}</div>
                {e.description && <div className="text-[11px] opacity-80 mt-0.5">{e.description}</div>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function formatStartedAt(iso: string | null): string {
  if (!iso) return 'just now';
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 60_000) return 'just now';
  // Show as "10:14 AM" — locale-aware, no seconds.
  return `at ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

function Thumb({ machine, imageUrl }: { machine: Machine; imageUrl: string | null }) {
  if (imageUrl) {
    return (
      <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0">
        <Image src={imageUrl} alt={machine.name} fill className="object-cover" sizes="64px" />
      </div>
    );
  }
  const [bg, fg] = brandColors(machine.brand);
  const initials = assetInitials(machine.brand ?? machine.name);
  return (
    <div className={`w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0 ${bg}`}>
      <span className={`text-base font-bold ${fg}`}>{initials}</span>
    </div>
  );
}

function TelematicsBlock({ machine }: { machine: Machine }) {
  const snap = machine.lastSnapshot;
  if (!snap) return null;
  const i = snap.insights;
  const items: { label: string; value: string }[] = [];
  if (i.cumulativeEngineHours != null) {
    items.push({ label: 'Engine hours', value: `${Math.round(i.cumulativeEngineHours)} h` });
  }
  if (i.cumulativeOperatingHours != null) {
    items.push({ label: 'Operating hours', value: `${Math.round(i.cumulativeOperatingHours)} h` });
  }
  if (i.fuelLevel != null) {
    items.push({ label: 'Fuel', value: `${Math.round(i.fuelLevel)}%` });
  }
  if (i.batteryStateOfChargePercent != null) {
    items.push({ label: 'Battery', value: `${Math.round(i.batteryStateOfChargePercent)}%` });
  }
  if (items.length === 0) return null;
  return (
    <div className="mt-5 grid grid-cols-2 gap-2">
      {items.map((it) => (
        <div key={it.label} className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">
            {it.label}
          </div>
          <div className="text-sm font-semibold text-slate-800">{it.value}</div>
        </div>
      ))}
    </div>
  );
}
