import { supabase } from './supabase';
import type { FleetMachine } from '../types';

export interface SessionRow {
  id: string;
  machine_id: string;
  machine_name: string;
  machine_brand: string | null;
  machine_model: string | null;
  machine_type: string | null;
  started_at: string;
  ended_at: string;
}

/** Persist a completed check-in. Best-effort: if the table/RLS isn't ready the
 *  app keeps working (the bar/timer are local) — we just log and move on. */
export async function saveSession(
  machine: FleetMachine,
  startedAt: number,
  endedAt: number
): Promise<boolean> {
  try {
    const { error } = await supabase.from('operator_sessions').insert({
      machine_id: machine.assetId,
      machine_name: machine.name,
      machine_brand: machine.brand,
      machine_model: machine.model,
      machine_type: machine.assetType,
      started_at: new Date(startedAt).toISOString(),
      ended_at: new Date(endedAt).toISOString(),
    });
    if (error) throw error;
    return true;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[operator] saveSession failed:', (e as Error).message);
    return false;
  }
}

/** The signed-in operator's completed sessions, newest first. */
export async function listMySessions(): Promise<{ rows: SessionRow[]; live: boolean }> {
  try {
    const { data, error } = await supabase
      .from('operator_sessions')
      .select('id,machine_id,machine_name,machine_brand,machine_model,machine_type,started_at,ended_at')
      .order('started_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return { rows: (data ?? []) as SessionRow[], live: true };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[operator] listMySessions failed, using sample log:', (e as Error).message);
    return { rows: [], live: false };
  }
}

export async function getSession(id: string): Promise<SessionRow | null> {
  try {
    const { data, error } = await supabase
      .from('operator_sessions')
      .select('id,machine_id,machine_name,machine_brand,machine_model,machine_type,started_at,ended_at')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return (data as SessionRow) ?? null;
  } catch {
    return null;
  }
}
