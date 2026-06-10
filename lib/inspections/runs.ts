import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Asset } from '@/lib/types';
import { escalationCountsForRuns } from './escalations';
import type {
  ChatMessage,
  InspectionRunStatus,
  IntentRun,
  Outcome,
  PreflightVerdict,
  RunRow,
  UnifiedRunRow,
} from './types';

/** UNIONs inspection_responses (form) + inspection_intent_runs (intent) and
 *  returns the most recently completed run for the given (machine, template).
 *  Used by the pre-flight resolver to surface "previous inspection summary"
 *  and the engine-hours delta. */
export async function getLastCompletedRun(
  accountId: string,
  machineId: string,
  templateId: string
): Promise<RunRow | null> {
  const supabase = createSupabaseServerClient();

  const [formQuery, intentQuery] = await Promise.all([
    supabase
      .from('inspection_responses')
      .select('id, template_id, machine_id, submitted_by, started_at, completed_at, status, summary, findings, engine_hours_at_start')
      .eq('account_id', accountId)
      .eq('machine_id', machineId)
      .eq('template_id', templateId)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('inspection_intent_runs')
      .select('id, template_id, machine_id, operator_id, started_at, completed_at, status, summary, findings, engine_hours_at_start')
      .eq('account_id', accountId)
      .eq('machine_id', machineId)
      .eq('template_id', templateId)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (formQuery.error) throw new Error(`Failed to load form run: ${formQuery.error.message}`);
  if (intentQuery.error) throw new Error(`Failed to load intent run: ${intentQuery.error.message}`);

  const form = formQuery.data
    ? mapFormRow(formQuery.data as Record<string, unknown>)
    : null;
  const intent = intentQuery.data
    ? mapIntentRow(intentQuery.data as Record<string, unknown>)
    : null;

  if (!form && !intent) return null;
  if (form && !intent) return form;
  if (intent && !form) return intent;
  // Both present → pick the latest completed_at.
  return (form!.completedAt ?? '') > (intent!.completedAt ?? '') ? form! : intent!;
}

function mapFormRow(r: Record<string, unknown>): RunRow {
  return {
    kind: 'form',
    id: r.id as string,
    templateId: r.template_id as string,
    machineId: (r.machine_id as string) ?? null,
    operatorId: (r.submitted_by as string) ?? null,
    startedAt: r.started_at as string,
    completedAt: (r.completed_at as string) ?? null,
    status: (r.status as InspectionRunStatus) ?? 'complete',
    summary: (r.summary as string) ?? null,
    findings: r.findings ?? null,
    engineHoursAtStart: (r.engine_hours_at_start as number) ?? null,
  };
}

function mapIntentRow(r: Record<string, unknown>): RunRow {
  return {
    kind: 'intent',
    id: r.id as string,
    templateId: r.template_id as string,
    machineId: (r.machine_id as string) ?? null,
    operatorId: (r.operator_id as string) ?? null,
    startedAt: r.started_at as string,
    completedAt: (r.completed_at as string) ?? null,
    status: (r.status as InspectionRunStatus) ?? 'in_progress',
    summary: (r.summary as string) ?? null,
    findings: r.findings ?? null,
    engineHoursAtStart: (r.engine_hours_at_start as number) ?? null,
  };
}

// ─── Intent runs CRUD ───────────────────────────────────────────────────────

export interface StartIntentRunInput {
  accountId: string;
  templateId: string;
  machineId: string | null;
  operatorId: string | null;
  yamlSnapshot: string;
  machineSnapshot: Asset | null;
  preflight: PreflightVerdict;
  engineHoursAtStart: number | null;
  operatingHoursAtStart: number | null;
}

export async function startIntentRun(input: StartIntentRunInput): Promise<{ id: string }> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('inspection_intent_runs')
    .insert({
      account_id: input.accountId,
      template_id: input.templateId,
      machine_id: input.machineId,
      operator_id: input.operatorId,
      yaml_snapshot: input.yamlSnapshot,
      preflight: input.preflight,
      engine_hours_at_start: input.engineHoursAtStart,
      operating_hours_at_start: input.operatingHoursAtStart,
      machine_state_at_start: input.machineSnapshot ?? null,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(`Failed to start intent run: ${error?.message}`);
  return { id: data.id as string };
}

export interface CompleteIntentRunInput {
  transcript: ChatMessage[];
  summary: string;
  findings: unknown;
  /** 'pass' | 'attention' | 'fail' — emitted by the complete_inspection tool. */
  outcome?: Outcome | null;
}

export async function completeIntentRun(
  accountId: string,
  runId: string,
  patch: CompleteIntentRunInput
): Promise<void> {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from('inspection_intent_runs')
    .update({
      status: 'complete',
      completed_at: new Date().toISOString(),
      transcript: patch.transcript,
      summary: patch.summary,
      findings: patch.findings ?? null,
      outcome: patch.outcome ?? null,
    })
    .eq('account_id', accountId)
    .eq('id', runId);
  if (error) throw new Error(`Failed to complete intent run: ${error.message}`);
}

export async function appendTranscript(
  accountId: string,
  runId: string,
  transcript: ChatMessage[]
): Promise<void> {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from('inspection_intent_runs')
    .update({ transcript })
    .eq('account_id', accountId)
    .eq('id', runId);
  if (error) throw new Error(`Failed to update transcript: ${error.message}`);
}

export async function getIntentRun(accountId: string, runId: string): Promise<IntentRun | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('inspection_intent_runs')
    .select('*')
    .eq('account_id', accountId)
    .eq('id', runId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load intent run: ${error.message}`);
  if (!data) return null;
  const r = data as Record<string, unknown>;
  return {
    id: r.id as string,
    accountId: r.account_id as string,
    templateId: r.template_id as string,
    machineId: (r.machine_id as string) ?? null,
    operatorId: (r.operator_id as string) ?? null,
    status: (r.status as InspectionRunStatus) ?? 'in_progress',
    startedAt: r.started_at as string,
    completedAt: (r.completed_at as string) ?? null,
    yamlSnapshot: r.yaml_snapshot as string,
    transcript: (r.transcript as ChatMessage[]) ?? [],
    preflight: (r.preflight as PreflightVerdict) ?? null,
    engineHoursAtStart: (r.engine_hours_at_start as number) ?? null,
    operatingHoursAtStart: (r.operating_hours_at_start as number) ?? null,
    machineStateAtStart: r.machine_state_at_start,
    summary: (r.summary as string) ?? null,
    findings: r.findings,
    outcome: (r.outcome as Outcome) ?? null,
  };
}

// ─── Listing (used by /inspection-history) ──────────────────────────────────

export interface ListRunsFilters {
  machineId?: string;
  templateId?: string;
  outcome?: Outcome;
  since?: string;
  limit?: number;
  /** Fleet-scope filter (from getSessionContext.allowedFleetIds).
   *    undefined / null → unrestricted
   *    string[]         → only runs on machines whose fleet_id is in this set */
  allowedFleetIds?: string[] | null;
}

/** Pulls intent runs with optional filters. Mirrors listResponses shape. */
export async function listIntentRuns(
  accountId: string,
  filters: ListRunsFilters = {}
): Promise<IntentRun[]> {
  const supabase = createSupabaseServerClient();

  // Resolve fleet scope to a machine-id whitelist, if scoped.
  let scopedMachineIds: string[] | null = null;
  if (filters.allowedFleetIds != null) {
    if (filters.allowedFleetIds.length === 0) return [];
    const { data: ms, error: msErr } = await supabase
      .from('machines')
      .select('id')
      .eq('account_id', accountId)
      .in('fleet_id', filters.allowedFleetIds);
    if (msErr) throw new Error(`Failed to resolve scoped machines: ${msErr.message}`);
    scopedMachineIds = (ms ?? []).map((m) => (m as { id: string }).id);
    if (scopedMachineIds.length === 0) return [];
  }

  let q = supabase
    .from('inspection_intent_runs')
    .select('*')
    .eq('account_id', accountId)
    .order('started_at', { ascending: false });
  if (filters.machineId) q = q.eq('machine_id', filters.machineId);
  if (filters.templateId) q = q.eq('template_id', filters.templateId);
  if (filters.outcome) q = q.eq('outcome', filters.outcome);
  if (filters.since) q = q.gte('started_at', filters.since);
  if (scopedMachineIds) q = q.in('machine_id', scopedMachineIds);
  if (filters.limit) q = q.limit(filters.limit);
  const { data, error } = await q;
  if (error) throw new Error(`Failed to list intent runs: ${error.message}`);
  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: r.id as string,
      accountId: r.account_id as string,
      templateId: r.template_id as string,
      machineId: (r.machine_id as string) ?? null,
      operatorId: (r.operator_id as string) ?? null,
      status: (r.status as InspectionRunStatus) ?? 'in_progress',
      startedAt: r.started_at as string,
      completedAt: (r.completed_at as string) ?? null,
      yamlSnapshot: (r.yaml_snapshot as string) ?? '',
      transcript: (r.transcript as ChatMessage[]) ?? [],
      preflight: (r.preflight as IntentRun['preflight']) ?? null,
      engineHoursAtStart: (r.engine_hours_at_start as number) ?? null,
      operatingHoursAtStart: (r.operating_hours_at_start as number) ?? null,
      machineStateAtStart: r.machine_state_at_start,
      summary: (r.summary as string) ?? null,
      findings: r.findings,
      outcome: (r.outcome as Outcome) ?? null,
    };
  });
}

export interface ListAllRunsFilters extends ListRunsFilters {
  kind?: 'form' | 'intent';
  /** Internal: resolved machine-id whitelist when caller is fleet-scoped. */
  machineIdsScope?: string[];
}

/** Returns the unified run list across both inspection_responses and
 *  inspection_intent_runs, joined with template name + machine name and
 *  per-run escalation counts. Sorted by startedAt desc. */
export async function listAllRuns(
  accountId: string,
  filters: ListAllRunsFilters = {}
): Promise<UnifiedRunRow[]> {
  const supabase = createSupabaseServerClient();

  const wantForm = filters.kind !== 'intent';
  const wantIntent = filters.kind !== 'form';
  const limit = filters.limit ?? 100;

  // Pre-resolve which machine IDs are in scope when the caller is fleet-scoped.
  let scopedMachineIds: string[] | null = null;
  if (filters.allowedFleetIds != null) {
    if (filters.allowedFleetIds.length === 0) return [];
    const { data: ms, error: msErr } = await supabase
      .from('machines')
      .select('id')
      .eq('account_id', accountId)
      .in('fleet_id', filters.allowedFleetIds);
    if (msErr) throw new Error(`Failed to resolve scoped machines: ${msErr.message}`);
    scopedMachineIds = (ms ?? []).map((m) => (m as { id: string }).id);
    if (scopedMachineIds.length === 0) return [];
  }
  const effectiveFilters: ListAllRunsFilters = scopedMachineIds
    ? { ...filters, allowedFleetIds: null, machineIdsScope: scopedMachineIds } as ListAllRunsFilters
    : filters;

  const [formRes, intentRes] = await Promise.all([
    wantForm
      ? buildFormListQuery(supabase, accountId, effectiveFilters, limit)
      : Promise.resolve({ data: [], error: null } as { data: unknown[]; error: null }),
    wantIntent
      ? buildIntentListQuery(supabase, accountId, effectiveFilters, limit)
      : Promise.resolve({ data: [], error: null } as { data: unknown[]; error: null }),
  ]);
  if ((formRes as { error: unknown }).error)
    throw new Error(`Failed to list responses: ${(formRes as { error: { message: string } }).error.message}`);
  if ((intentRes as { error: unknown }).error)
    throw new Error(`Failed to list intent runs: ${(intentRes as { error: { message: string } }).error.message}`);

  // Resolve template + machine names in a single round trip each.
  const formRows = (formRes.data ?? []) as FormJoinRow[];
  const intentRows = (intentRes.data ?? []) as IntentJoinRow[];
  const templateIds = Array.from(
    new Set([
      ...formRows.map((r) => r.template_id),
      ...intentRows.map((r) => r.template_id),
    ])
  );
  const machineIds = Array.from(
    new Set(
      [
        ...formRows.map((r) => r.machine_id),
        ...intentRows.map((r) => r.machine_id),
      ].filter((id): id is string => !!id)
    )
  );

  const [tplLookup, machineLookup, escalations] = await Promise.all([
    templateIds.length
      ? supabase
          .from('inspection_templates')
          .select('id, name, handle')
          .in('id', templateIds)
          .then((r) => r.data ?? [])
      : Promise.resolve([] as { id: string; name: string; handle: string }[]),
    machineIds.length
      ? supabase
          .from('machines')
          .select('id, name')
          .in('id', machineIds)
          .then((r) => r.data ?? [])
      : Promise.resolve([] as { id: string; name: string }[]),
    escalationCountsForRuns(accountId, {
      responseIds: formRows.map((r) => r.id),
      intentRunIds: intentRows.map((r) => r.id),
    }),
  ]);
  const tplById = Object.fromEntries(
    (tplLookup as { id: string; name: string; handle: string }[]).map((t) => [t.id, t])
  );
  const machineNameById = Object.fromEntries(
    (machineLookup as { id: string; name: string }[]).map((m) => [m.id, m.name])
  );

  const unified: UnifiedRunRow[] = [
    ...formRows.map((r) => ({
      kind: 'form' as const,
      id: r.id,
      templateId: r.template_id,
      machineId: r.machine_id,
      operatorId: r.submitted_by,
      startedAt: r.started_at ?? r.submitted_at,
      completedAt: r.completed_at ?? r.submitted_at,
      status: (r.status as InspectionRunStatus) ?? 'complete',
      summary: r.summary,
      findings: r.findings ?? null,
      engineHoursAtStart: r.engine_hours_at_start,
      outcome: (r.outcome as Outcome) ?? null,
      templateName: tplById[r.template_id]?.name ?? '(deleted template)',
      templateHandle: tplById[r.template_id]?.handle ?? '?',
      machineName: r.machine_id ? machineNameById[r.machine_id] ?? null : null,
      escalationCount: escalations.byResponseId[r.id] ?? 0,
    })),
    ...intentRows.map((r) => ({
      kind: 'intent' as const,
      id: r.id,
      templateId: r.template_id,
      machineId: r.machine_id,
      operatorId: r.operator_id,
      startedAt: r.started_at,
      completedAt: r.completed_at,
      status: (r.status as InspectionRunStatus) ?? 'in_progress',
      summary: r.summary,
      findings: r.findings ?? null,
      engineHoursAtStart: r.engine_hours_at_start,
      outcome: (r.outcome as Outcome) ?? null,
      templateName: tplById[r.template_id]?.name ?? '(deleted template)',
      templateHandle: tplById[r.template_id]?.handle ?? '?',
      machineName: r.machine_id ? machineNameById[r.machine_id] ?? null : null,
      escalationCount: escalations.byIntentRunId[r.id] ?? 0,
    })),
  ];

  unified.sort((a, b) => (a.startedAt < b.startedAt ? 1 : a.startedAt > b.startedAt ? -1 : 0));
  return unified.slice(0, limit);
}

interface FormJoinRow {
  id: string;
  template_id: string;
  machine_id: string | null;
  submitted_by: string | null;
  submitted_at: string;
  started_at: string | null;
  completed_at: string | null;
  status: string;
  summary: string | null;
  findings: unknown;
  engine_hours_at_start: number | null;
  outcome: string | null;
}

interface IntentJoinRow {
  id: string;
  template_id: string;
  machine_id: string | null;
  operator_id: string | null;
  started_at: string;
  completed_at: string | null;
  status: string;
  summary: string | null;
  findings: unknown;
  engine_hours_at_start: number | null;
  outcome: string | null;
}

function buildFormListQuery(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  accountId: string,
  filters: ListAllRunsFilters,
  limit: number
) {
  let q = supabase
    .from('inspection_responses')
    .select(
      'id, template_id, machine_id, submitted_by, submitted_at, started_at, completed_at, status, summary, findings, engine_hours_at_start, outcome'
    )
    .eq('account_id', accountId)
    .order('started_at', { ascending: false })
    .limit(limit);
  if (filters.machineId) q = q.eq('machine_id', filters.machineId);
  if (filters.templateId) q = q.eq('template_id', filters.templateId);
  if (filters.outcome) q = q.eq('outcome', filters.outcome);
  if (filters.since) q = q.gte('started_at', filters.since);
  if (filters.machineIdsScope) q = q.in('machine_id', filters.machineIdsScope);
  return q;
}

function buildIntentListQuery(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  accountId: string,
  filters: ListAllRunsFilters,
  limit: number
) {
  let q = supabase
    .from('inspection_intent_runs')
    .select(
      'id, template_id, machine_id, operator_id, started_at, completed_at, status, summary, findings, engine_hours_at_start, outcome'
    )
    .eq('account_id', accountId)
    .order('started_at', { ascending: false })
    .limit(limit);
  if (filters.machineId) q = q.eq('machine_id', filters.machineId);
  if (filters.templateId) q = q.eq('template_id', filters.templateId);
  if (filters.outcome) q = q.eq('outcome', filters.outcome);
  if (filters.since) q = q.gte('started_at', filters.since);
  if (filters.machineIdsScope) q = q.in('machine_id', filters.machineIdsScope);
  return q;
}
