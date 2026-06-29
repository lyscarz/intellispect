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
}

const CheckInContext = createContext<CheckInContextValue>({
  checkIn: null,
  checkInTo: () => {},
  checkOut: () => {},
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
    // Persist the completed session to Supabase (best-effort) before clearing.
    if (checkIn) void saveSession(checkIn.machine, checkIn.startedAt, Date.now());
    setCheckIn(null);
  };

  return (
    <CheckInContext.Provider value={{ checkIn, checkInTo, checkOut }}>
      {children}
    </CheckInContext.Provider>
  );
}

export function useCheckIn() {
  return useContext(CheckInContext);
}
