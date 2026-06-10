'use client';

import { usePathname } from 'next/navigation';
import { useCheckIn, useElapsed } from '@/lib/use-check-in';

/** Persistent bar pinned just above the tab bar whenever a machine
 *  check-in is active. Shows the machine name + running timer + a
 *  Check-out button. Click anywhere outside the button to navigate to the
 *  check-in tab. */
export function CheckInBar() {
  const { state, checkOut } = useCheckIn();
  const elapsed = useElapsed(state?.startedAt ?? null);
  const pathname = usePathname();

  // Same hidden-on-full-screen rule as the tab bar.
  if (
    pathname.startsWith('/m/run/') ||
    pathname.startsWith('/m/run-intent/') ||
    pathname.startsWith('/m/done/')
  ) {
    return null;
  }

  if (!state) return null;

  return (
    <div
      className="fixed left-0 right-0 z-30 bg-emerald-600 text-white px-4 py-2 flex items-center gap-3 shadow-lg"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 56px)' }}
      role="status"
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="relative inline-flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75 animate-ping" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-200" />
        </span>
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wide opacity-80">Checked in</div>
          <div className="text-sm font-semibold truncate">{state.machineName}</div>
        </div>
      </div>
      <div className="font-mono text-sm tabular-nums">{elapsed}</div>
      <button
        type="button"
        onClick={checkOut}
        className="px-3 py-1.5 rounded-md bg-white/15 hover:bg-white/25 text-xs font-semibold"
      >
        Check out
      </button>
    </div>
  );
}
