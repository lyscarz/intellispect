'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'intellicheck.checkin.v1';

export interface CheckInState {
  machineId: string;
  machineName: string;
  startedAt: string; // ISO
}

interface StoredEnvelope {
  state: CheckInState | null;
}

function read(): CheckInState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredEnvelope;
    return parsed?.state ?? null;
  } catch {
    return null;
  }
}

function write(state: CheckInState | null) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ state } satisfies StoredEnvelope)
    );
    // Notify other tabs and the rest of this tab via a custom event.
    window.dispatchEvent(new CustomEvent('intellicheck-checkin-changed'));
  } catch {
    // ignore
  }
}

/** Client-side check-in state. Persists across navigation + reload via
 *  localStorage. Cross-tab updates handled via storage events + a custom
 *  event for same-tab subscribers. */
export function useCheckIn(): {
  state: CheckInState | null;
  checkIn: (input: Omit<CheckInState, 'startedAt'>) => void;
  checkOut: () => void;
} {
  const [state, setState] = useState<CheckInState | null>(null);

  useEffect(() => {
    setState(read());
    const onChange = () => setState(read());
    window.addEventListener('storage', onChange);
    window.addEventListener('intellicheck-checkin-changed', onChange);
    return () => {
      window.removeEventListener('storage', onChange);
      window.removeEventListener('intellicheck-checkin-changed', onChange);
    };
  }, []);

  const checkIn = useCallback(
    ({ machineId, machineName }: Omit<CheckInState, 'startedAt'>) => {
      const next: CheckInState = { machineId, machineName, startedAt: new Date().toISOString() };
      write(next);
      setState(next);
    },
    []
  );

  const checkOut = useCallback(() => {
    write(null);
    setState(null);
  }, []);

  return { state, checkIn, checkOut };
}

/** Live-updating "12:34" formatted duration. Re-renders every second. */
export function useElapsed(since: string | null): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!since) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [since]);
  if (!since) return '00:00';
  const ms = Math.max(0, now - new Date(since).getTime());
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
