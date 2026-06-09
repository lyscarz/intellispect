import type { Machine } from '@/lib/types';
import { buildMachineContext } from './assignments';
import type { PreflightInputs, RunRow } from './types';

const CONTINUING_SESSION_HOURS = 2;

/** Distills a machine + its last completed run + the current user into the
 *  PreflightInputs blob the LLM verdict prompt receives. All numeric deltas
 *  and the session-state decision are computed here so the model doesn't
 *  have to do arithmetic. */
export function buildPreflightInputs(
  machine: Machine,
  siteName: string | null,
  lastRun: RunRow | null,
  currentUserId: string
): PreflightInputs {
  const snap = machine.lastSnapshot;
  const attention = snap?.attention ?? null;

  const cumulativeEngineHours = snap?.insights.cumulativeEngineHours ?? null;
  const lastEngineHours = lastRun?.engineHoursAtStart ?? null;
  const engineHoursDelta =
    cumulativeEngineHours != null && lastEngineHours != null
      ? Math.max(0, cumulativeEngineHours - lastEngineHours)
      : null;

  const hoursSinceLastInspection = lastRun?.completedAt
    ? (Date.now() - new Date(lastRun.completedAt).getTime()) / (1000 * 60 * 60)
    : null;

  const sessionState: PreflightInputs['sessionState'] =
    lastRun &&
    lastRun.operatorId === currentUserId &&
    hoursSinceLastInspection != null &&
    hoursSinceLastInspection < CONTINUING_SESSION_HOURS
      ? 'continuing'
      : 'new';

  // Limit events to the 8 most recent active to keep the prompt focused.
  const recentEvents = (snap?.events ?? [])
    .filter((e) => e.active)
    .sort((a, b) => (b.openedAt ?? '').localeCompare(a.openedAt ?? ''))
    .slice(0, 8)
    .map((e) => ({
      type: e.type,
      severity: e.severity,
      openedAt: e.openedAt,
      description: e.description ?? e.descriptionPoweredByOem ?? null,
    }));

  return {
    machine: buildMachineContext(machine, siteName),
    lastSyncedAt: machine.lastSyncedAt,
    activity: snap?.activity ?? null,
    criticality: attention?.criticality ?? null,
    criticalEventCount: attention?.criticalEventCount ?? 0,
    lowEventCount: attention?.lowEventCount ?? 0,
    recentEvents,
    fuelLevel: snap?.insights.fuelLevel ?? null,
    batteryStateOfChargePercent: snap?.insights.batteryStateOfChargePercent ?? null,
    cumulativeOperatingHours: snap?.insights.cumulativeOperatingHours ?? null,
    cumulativeEngineHours,
    lastRun: lastRun
      ? {
          completedAt: lastRun.completedAt!,
          summary: lastRun.summary,
          operatorId: lastRun.operatorId,
          engineHoursAtStart: lastRun.engineHoursAtStart,
          findings: lastRun.findings ?? null,
        }
      : null,
    hoursSinceLastInspection,
    engineHoursDelta,
    sessionState,
  };
}
