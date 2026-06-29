import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { FleetMachine } from '../types';
import { saveSession } from './sessions';

export interface CheckInState {
  machine: FleetMachine;
  startedAt: number; // epoch ms
}

interface CheckInContextValue {
  checkIn: CheckInState | null;
  checkInTo: (machine: FleetMachine) => void;
  checkOut: () => void;
  /** Bumps whenever a session is written (checkout), so views like the Log can
   *  refetch live without a manual reload. */
  sessionsVersion: number;
}

const CheckInContext = createContext<CheckInContextValue>({
  checkIn: null,
  checkInTo: () => {},
  checkOut: () => {},
  sessionsVersion: 0,
});

const KEY = 'operator-checkin';

function load(): CheckInState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.machine && typeof parsed.startedAt === 'number') return parsed as CheckInState;
  } catch {
    /* ignore */
  }
  return null;
}

export function CheckInProvider({ children }: { children: ReactNode }) {
  const [checkIn, setCheckIn] = useState<CheckInState | null>(() => load());
  const [sessionsVersion, setSessionsVersion] = useState(0);

  // Persist so the session (and its timer) survive a reload.
  useEffect(() => {
    try {
      if (checkIn) localStorage.setItem(KEY, JSON.stringify(checkIn));
      else localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }, [checkIn]);

  const checkInTo = (machine: FleetMachine) => setCheckIn({ machine, startedAt: Date.now() });
  const checkOut = () => {
    const ci = checkIn;
    // Clear immediately for a snappy UI, then persist to Supabase and bump the
    // version so the Log refetches the new session live (no reload needed).
    setCheckIn(null);
    if (ci) {
      saveSession(ci.machine, ci.startedAt, Date.now()).finally(() =>
        setSessionsVersion((v) => v + 1)
      );
    }
  };

  return (
    <CheckInContext.Provider value={{ checkIn, checkInTo, checkOut, sessionsVersion }}>
      {children}
    </CheckInContext.Provider>
  );
}

export function useCheckIn() {
  return useContext(CheckInContext);
}
