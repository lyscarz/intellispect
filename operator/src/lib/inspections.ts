import { supabase } from './supabase';
import { streamSSE } from './sse';
import type {
  FormSchema,
  InspectionTemplate,
  MachineContext,
  Outcome,
  SubmittedAnswer,
  SubmittedComment,
} from './inspectionTypes';
import type { FleetMachine } from '../types';

// Desktop Next.js origin that hosts the AI inspection API routes. The form flow
// talks to Supabase directly; only the intent (AI) flow needs this.
const API_BASE = (import.meta.env.VITE_INSPECTIONS_API_BASE ?? 'http://localhost:3000').replace(
  /\/$/,
  ''
);

/** Build the lightweight machine context the runner header + AI use. */
export function machineContext(m: FleetMachine): MachineContext {
  return {
    id: m.assetId,
    name: m.name,
    brand: m.brand,
    model: m.model,
    assetType: m.assetType,
    siteName: null,
  };
}

/**
 * Resolve the *active* inspection templates assigned to a machine, mirroring the
 * desktop's assignments resolver:
 *   - 'all' rules match always
 *   - 'type' rules match when assetType === target_value
 *   - 'machine' rules match when machines.id === target_id (== Asset.assetId)
 * ('site' rules can't match — the mobile app has no siteId.)
 * RLS scopes rows to the operator's account, so no account_id filter is needed.
 */
export async function templatesForMachine(m: FleetMachine): Promise<InspectionTemplate[]> {
  const orParts: string[] = ['target_kind.eq.all'];
  if (m.assetType) orParts.push(`and(target_kind.eq.type,target_value.eq.${m.assetType})`);
  orParts.push(`and(target_kind.eq.machine,target_id.eq.${m.assetId})`);

  const { data, error } = await supabase
    .from('inspection_assignments')
    .select('template_id, inspection_templates!inner(*)')
    .eq('inspection_templates.status', 'active')
    .or(orParts.join(','));
  if (error) throw new Error(`Failed to resolve templates: ${error.message}`);

  const seen = new Set<string>();
  const out: InspectionTemplate[] = [];
  for (const row of data ?? []) {
    // The !inner join surfaces the template; Supabase types it loosely, so the
    // value may arrive as a single object or a one-element array depending on
    // the inferred relationship.
    const joined = (row as { inspection_templates: unknown }).inspection_templates;
    const tpl = (Array.isArray(joined) ? joined[0] : joined) as InspectionTemplate | null;
    if (!tpl || seen.has(tpl.id)) continue;
    seen.add(tpl.id);
    out.push(tpl);
  }
  // Stable order: AI/intent first (the headline feature), then by name.
  out.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'intent' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return out;
}

/** Pure outcome derivation — ported verbatim from lib/inspections/responses.ts. */
export function deriveFormOutcome(
  schema: FormSchema,
  answers: Record<string, SubmittedAnswer>,
  comments: Record<string, SubmittedComment>
): Outcome {
  let worst: Outcome = 'pass';
  const bump = (o: Outcome) => {
    if (o === 'fail') worst = 'fail';
    else if (o === 'attention' && worst === 'pass') worst = 'attention';
  };

  for (const section of schema.sections) {
    for (const q of section.questions) {
      const a = answers[q.id];
      if (!a) continue;
      const sev = q.severity;
      const cfg = q.answer;

      let bad = false;
      if (cfg.type === 'yes_no' && a.type === 'yes_no') {
        bad = a.value !== null && a.value !== cfg.correct;
      } else if (cfg.type === 'yes_no_na' && a.type === 'yes_no_na') {
        bad = a.value !== null && a.value !== cfg.correct;
      } else if (cfg.type === 'measurement' && a.type === 'measurement') {
        if (a.value !== null) {
          if (cfg.min !== undefined && a.value < cfg.min) bad = true;
          if (cfg.max !== undefined && a.value > cfg.max) bad = true;
        }
      }

      if (!bad) continue;
      if (sev === 'high' || sev === 'critical') bump('fail');
      else if (sev === 'medium') bump('attention');
      else if (sev === 'low' && comments[q.id]?.hasPhoto) bump('attention');
    }
  }
  return worst;
}

export interface SubmitFormArgs {
  template: InspectionTemplate;
  machine: FleetMachine;
  answers: Record<string, SubmittedAnswer>;
  comments: Record<string, SubmittedComment>;
}

/**
 * Insert one inspection_responses row directly via the authenticated client.
 * RLS (is_member_of(account_id)) authorises the operator. Photos are recorded as
 * filledSlots only — binary upload to Storage is deferred (see plan).
 */
export async function submitFormResponse(
  args: SubmitFormArgs
): Promise<{ id: string; outcome: Outcome }> {
  const { template, machine, answers, comments } = args;
  const schema = template.form_schema ?? { sections: [] };
  const outcome = deriveFormOutcome(schema, answers, comments);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('inspection_responses')
    .insert({
      account_id: template.account_id,
      template_id: template.id,
      template_snapshot: schema,
      machine_id: machine.assetId,
      submitted_by: user?.id ?? null,
      answers,
      comments,
      status: 'complete',
      started_at: now,
      completed_at: now,
      outcome,
      summary: null,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`Failed to save inspection: ${error?.message}`);
  return { id: (data as { id: string }).id, outcome };
}

async function authHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Not signed in');
  return { Authorization: `Bearer ${token}` };
}

/** Start a server-side intent run (preflight + persisted row). Returns its id. */
export async function startIntentRun(
  template: InspectionTemplate,
  machine: FleetMachine
): Promise<{ runId: string }> {
  const res = await fetch(`${API_BASE}/api/inspections/runs/intent-start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ templateId: template.id, machineId: machine.assetId }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Failed to start inspection (${res.status})`);
  }
  const data = (await res.json()) as { runId: string };
  return { runId: data.runId };
}

export interface IntentTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** Stream one turn of the intent conversation, forwarding SSE events. */
export async function streamIntent(
  template: InspectionTemplate,
  machine: FleetMachine,
  messages: IntentTurn[],
  runId: string | null,
  onEvent: (event: string, data: unknown) => void
): Promise<void> {
  await streamSSE(
    `${API_BASE}/api/inspections/run-intent`,
    { templateId: template.id, messages, machine: machineContext(machine), runId },
    onEvent,
    await authHeaders()
  );
}
