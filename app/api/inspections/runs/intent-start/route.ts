import { NextRequest, NextResponse } from 'next/server';
import { resolveApiSession, ApiAuthError, corsHeaders, corsPreflight } from '@/lib/apiSession';
import { getMachine } from '@/lib/machines';
import { getSite } from '@/lib/sites';
import { getTemplate } from '@/lib/inspections/repo';
import { getLastCompletedRun, startIntentRun } from '@/lib/inspections/runs';
import { buildPreflightInputs } from '@/lib/inspections/preflight';
import type { PreflightInputs } from '@/lib/inspections/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  templateId: string;
  machineId: string;
}

/** Speculative run start: the moment the admin clicks "Run" on an intent
 *  template, we:
 *    1. Compute PreflightInputs (telematics + last-run history + session).
 *    2. Persist a fresh inspection_intent_runs row with status='in_progress'
 *       and the inputs stashed in the `preflight` column for audit.
 *    3. Return { runId, preflightInputs } so the modal can hand the runner
 *       its server-side id AND surface the inputs in the admin debug panel.
 *  The intent AI itself sees the same inputs via /api/inspections/run-intent. */
export function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function POST(req: NextRequest) {
  const cors = corsHeaders(req.headers.get('origin'));
  let ctx;
  try {
    ctx = await resolveApiSession(req);
  } catch (e) {
    if (e instanceof ApiAuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status, headers: cors });
    }
    throw e;
  }
  const { templateId, machineId } = (await req.json()) as Body;
  if (!templateId || !machineId) {
    return NextResponse.json({ error: 'templateId, machineId required' }, { status: 400, headers: cors });
  }

  const [machine, template] = await Promise.all([
    getMachine(machineId, ctx.accountId),
    getTemplate(ctx.accountId, templateId),
  ]);
  if (!machine) return NextResponse.json({ error: 'Machine not found' }, { status: 404, headers: cors });
  if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404, headers: cors });
  if (template.kind !== 'intent' || !template.yaml_body) {
    return NextResponse.json({ error: 'Not an intent template' }, { status: 400, headers: cors });
  }

  const [lastRun, site] = await Promise.all([
    getLastCompletedRun(ctx.accountId, machine.id, templateId),
    machine.siteId ? getSite(machine.siteId, ctx.accountId) : Promise.resolve(null),
  ]);
  const preflightInputs: PreflightInputs = buildPreflightInputs(
    machine,
    site?.name ?? null,
    lastRun,
    ctx.userId
  );

  const snap = machine.lastSnapshot;
  const { id } = await startIntentRun({
    accountId: ctx.accountId,
    templateId,
    machineId,
    operatorId: ctx.userId,
    yamlSnapshot: template.yaml_body,
    machineSnapshot: snap,
    // The `preflight` column now holds the raw inputs the AI saw at start time
    // (not a verdict). Cast through unknown — the column is jsonb and the type
    // mirror PreflightVerdict was the previous tenant; here we store inputs.
    preflight: preflightInputs as unknown as Parameters<typeof startIntentRun>[0]['preflight'],
    engineHoursAtStart: snap?.insights.cumulativeEngineHours ?? null,
    operatingHoursAtStart: snap?.insights.cumulativeOperatingHours ?? null,
  });

  return NextResponse.json({ runId: id, preflightInputs }, { headers: cors });
}
