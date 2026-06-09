import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Escalation, EscalationKind, EscalationStatus } from './types';

interface EscalationRow {
  id: string;
  account_id: string;
  response_id: string | null;
  intent_run_id: string | null;
  machine_id: string | null;
  kind: EscalationKind;
  status: EscalationStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  resolved_at: string | null;
}

function rowToEscalation(r: EscalationRow): Escalation {
  return {
    id: r.id,
    accountId: r.account_id,
    responseId: r.response_id,
    intentRunId: r.intent_run_id,
    machineId: r.machine_id,
    kind: r.kind,
    status: r.status,
    notes: r.notes,
    createdBy: r.created_by,
    createdAt: r.created_at,
    resolvedAt: r.resolved_at,
  };
}

export interface ListEscalationsFilter {
  responseId?: string;
  intentRunId?: string;
  /** When provided, list escalations across all runs for this machine. */
  machineId?: string;
}

export async function listEscalations(
  accountId: string,
  filter: ListEscalationsFilter
): Promise<Escalation[]> {
  const supabase = createSupabaseServerClient();
  let q = supabase
    .from('inspection_escalations')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false });
  if (filter.responseId) q = q.eq('response_id', filter.responseId);
  if (filter.intentRunId) q = q.eq('intent_run_id', filter.intentRunId);
  if (filter.machineId) q = q.eq('machine_id', filter.machineId);
  const { data, error } = await q;
  if (error) throw new Error(`Failed to list escalations: ${error.message}`);
  return (data ?? []).map((r) => rowToEscalation(r as EscalationRow));
}

export interface CreateEscalationInput {
  responseId?: string;
  intentRunId?: string;
  machineId?: string | null;
  kind: EscalationKind;
  notes?: string;
}

export async function createEscalation(
  accountId: string,
  userId: string,
  input: CreateEscalationInput
): Promise<Escalation> {
  if (!!input.responseId === !!input.intentRunId) {
    throw new Error('Provide exactly one of responseId or intentRunId');
  }
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('inspection_escalations')
    .insert({
      account_id: accountId,
      response_id: input.responseId ?? null,
      intent_run_id: input.intentRunId ?? null,
      machine_id: input.machineId ?? null,
      kind: input.kind,
      notes: input.notes ?? null,
      created_by: userId,
    })
    .select('*')
    .single();
  if (error || !data) throw new Error(`Failed to create escalation: ${error?.message}`);
  return rowToEscalation(data as EscalationRow);
}

export async function resolveEscalation(accountId: string, id: string): Promise<void> {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from('inspection_escalations')
    .update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .eq('account_id', accountId)
    .eq('id', id);
  if (error) throw new Error(`Failed to resolve escalation: ${error.message}`);
}

/** Counts escalations per run id, used by /inspection-history to surface an
 *  "Escalated" chip on list rows without per-row queries. */
export async function escalationCountsForRuns(
  accountId: string,
  ids: { responseIds: string[]; intentRunIds: string[] }
): Promise<{ byResponseId: Record<string, number>; byIntentRunId: Record<string, number> }> {
  const out = {
    byResponseId: {} as Record<string, number>,
    byIntentRunId: {} as Record<string, number>,
  };
  if (ids.responseIds.length === 0 && ids.intentRunIds.length === 0) return out;

  const supabase = createSupabaseServerClient();
  let q = supabase
    .from('inspection_escalations')
    .select('response_id, intent_run_id')
    .eq('account_id', accountId);
  if (ids.responseIds.length > 0 && ids.intentRunIds.length > 0) {
    q = q.or(
      `response_id.in.(${ids.responseIds.join(',')}),intent_run_id.in.(${ids.intentRunIds.join(',')})`
    );
  } else if (ids.responseIds.length > 0) {
    q = q.in('response_id', ids.responseIds);
  } else {
    q = q.in('intent_run_id', ids.intentRunIds);
  }
  const { data, error } = await q;
  if (error) throw new Error(`Failed to count escalations: ${error.message}`);
  for (const row of (data ?? []) as { response_id: string | null; intent_run_id: string | null }[]) {
    if (row.response_id) {
      out.byResponseId[row.response_id] = (out.byResponseId[row.response_id] ?? 0) + 1;
    } else if (row.intent_run_id) {
      out.byIntentRunId[row.intent_run_id] =
        (out.byIntentRunId[row.intent_run_id] ?? 0) + 1;
    }
  }
  return out;
}
