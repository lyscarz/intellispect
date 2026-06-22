'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCheckIn, useElapsed } from '@/lib/use-check-in';

/** Persistent bar shown when checked in, pinned above the tab bar on
 *  non-/m tabs. Visually IDENTICAL to the bar state of the MachineSheet on
 *  /m — same rounded top, same emerald, same drag-handle hint — so the
 *  operator feels like the bar and the sheet are one element across the
 *  app. Tapping the info area routes to /m and expands the sheet. */
export function CheckInBar() {
  const { state, checkOut } = useCheckIn();
  const elapsed = useElapsed(state?.startedAt ?? null);
  const pathname = usePathname();

  // Don't render on /m — there the sheet's own bar state takes over.
  if (pathname === '/m') return null;

  // Hidden on full-screen flows.
  if (
    pathname.startsWith('/m/run/') ||
    pathname.startsWith('/m/run-intent/') ||
    pathname.startsWith('/m/done/')
  ) {
    return null;
  }

  if (!state) return null;

  const href = `/m?openMachine=${encodeURIComponent(state.machineId)}`;

  return (
    <div
      className="fixed left-0 right-0 z-30 bg-emerald-600 text-white shadow-[0_-12px_40px_-12px_rgba(15,23,42,0.35)] rounded-t-3xl"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 56px)' }}
      role="status"
    >
      {/* Drag-handle hint — purely decorative on non-/m tabs (no drag here),
          but matches the sheet's bar state visually so they feel like the
          same element. */}
      <div className="flex justify-center pt-2 pb-1">
        <div className="w-9 h-1.5 rounded-full bg-white/55" />
      </div>
      <div className="flex items-stretch">
        <Link
          href={href}
          prefetch={false}
          className="flex-1 flex items-center gap-3 px-4 pb-3 active:opacity-90"
        >
          <span className="relative inline-flex h-2.5 w-2.5 flex-shrink-0">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75 animate-ping" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-200" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-wide opacity-80 font-semibold">
              Checked in
            </div>
            <div className="text-sm font-semibold truncate">{state.machineName}</div>
          </div>
          <div className="font-mono text-sm tabular-nums opacity-90">{elapsed}</div>
        </Link>
        <button
          type="button"
          onClick={checkOut}
          className="flex-shrink-0 mr-3 mb-3 px-3 py-1.5 self-end rounded-lg bg-white/15 hover:bg-white/25 active:bg-white/25 text-xs font-semibold"
        >
          Check out
        </button>
      </div>
    </div>
  );
}
