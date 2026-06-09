import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Machine } from '@/lib/types';
import type {
  Assignment,
  AssignmentKind,
  InspectionTemplate,
  MachineContext,
} from './types';

interface AssignmentRow {
  id: string;
  account_id: string;
  template_id: string;
  target_kind: AssignmentKind;
  target_id: string | null;
  target_value: string | null;
  created_at: string;
}

function rowToAssignment(r: AssignmentRow): Assignment {
  return {
    id: r.id,
    accountId: r.account_id,
    templateId: r.template_id,
    targetKind: r.target_kind,
    targetId: r.target_id,
    targetValue: r.target_value,
    createdAt: r.created_at,
  };
}

export async function listAssignmentsForTemplate(
  accountId: string,
  templateId: string
): Promise<Assignment[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('inspection_assignments')
    .select('*')
    .eq('account_id', accountId)
    .eq('template_id', templateId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`Failed to list assignments: ${error.message}`);
  return (data ?? []).map((r) => rowToAssignment(r as AssignmentRow));
}

export interface AddAssignmentInput {
  templateId: string;
  targetKind: AssignmentKind;
  targetId?: string | null;
  targetValue?: string | null;
}

export async function addAssignment(
  accountId: string,
  userId: string,
  input: AddAssignmentInput
): Promise<Assignment | null> {
  // Normalise per the table CHECK constraint.
  const row = {
    account_id: accountId,
    template_id: input.templateId,
    target_kind: input.targetKind,
    target_id: input.targetKind === 'site' || input.targetKind === 'machine' ? input.targetId ?? null : null,
    target_value: input.targetKind === 'type' ? input.targetValue ?? null : null,
    created_by: userId,
  };

  if (
    (row.target_kind === 'site' || row.target_kind === 'machine') &&
    !row.target_id
  ) {
    throw new Error(`Missing target_id for ${row.target_kind} assignment`);
  }
  if (row.target_kind === 'type' && !row.target_value) {
    throw new Error('Missing target_value for type assignment');
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('inspection_assignments')
    .insert(row)
    .select('*')
    .single();
  if (error) {
    // Unique violation = same scope already assigned. Treat as a no-op so the
    // UI doesn't need to dedupe — the chip is already there.
    if (error.code === '23505') return null;
    throw new Error(`Failed to add assignment: ${error.message}`);
  }
  return rowToAssignment(data as AssignmentRow);
}

export async function removeAssignment(accountId: string, id: string): Promise<void> {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from('inspection_assignments')
    .delete()
    .eq('account_id', accountId)
    .eq('id', id);
  if (error) throw new Error(`Failed to remove assignment: ${error.message}`);
}

/** Returns the templates whose assignments match this machine.
 *  - 'all' rules match always
 *  - 'site' rules match when machine.siteId === target_id
 *  - 'type' rules match when machine.lastSnapshot.assetType === target_value
 *  - 'machine' rules match when machine.id === target_id
 *  Dangling rules (deleted site/machine) silently never match. */
export async function templatesForMachine(
  accountId: string,
  machine: Machine,
  opts: { includeDrafts?: boolean } = {}
): Promise<InspectionTemplate[]> {
  const supabase = createSupabaseServerClient();
  const assetType = machine.lastSnapshot?.assetType ?? null;

  // Build the OR predicate. Supabase JS uses comma-separated filters within `or()`.
  const orParts: string[] = ['target_kind.eq.all'];
  if (machine.siteId) orParts.push(`and(target_kind.eq.site,target_id.eq.${machine.siteId})`);
  if (assetType) orParts.push(`and(target_kind.eq.type,target_value.eq.${assetType})`);
  orParts.push(`and(target_kind.eq.machine,target_id.eq.${machine.id})`);

  let q = supabase
    .from('inspection_assignments')
    .select('template_id, inspection_templates!inner(*)')
    .eq('account_id', accountId)
    .or(orParts.join(','));

  if (!opts.includeDrafts) {
    q = q.eq('inspection_templates.status', 'active');
  }

  const { data, error } = await q;
  if (error) throw new Error(`Failed to resolve templates: ${error.message}`);

  // Dedupe: a template can match via multiple rules (e.g. "all" + "site").
  const seen = new Set<string>();
  const out: InspectionTemplate[] = [];
  for (const row of data ?? []) {
    const tpl = (row as { inspection_templates: unknown }).inspection_templates as
      | { id: string; chat_history: unknown }
      | null;
    if (!tpl || seen.has(tpl.id)) continue;
    seen.add(tpl.id);
    // Match the InspectionTemplate row->object shape used by repo.ts.
    const r = tpl as unknown as InspectionTemplate & { chat_history: unknown };
    out.push({ ...r, chat_history: (r.chat_history as InspectionTemplate['chat_history']) ?? [] });
  }
  return out;
}

/** Distinct list of assetType values across the account's machines. Used to
 *  populate the "Type" assignment picker so admins can only assign to types
 *  that actually exist. */
export function distinctAssetTypes(machines: Machine[]): string[] {
  const set = new Set<string>();
  for (const m of machines) {
    const t = m.lastSnapshot?.assetType;
    if (t) set.add(t);
  }
  return Array.from(set).sort();
}

export function buildMachineContext(machine: Machine, siteName: string | null): MachineContext {
  return {
    id: machine.id,
    name: machine.name,
    brand: machine.brand,
    model: machine.model,
    assetType: machine.lastSnapshot?.assetType ?? null,
    siteName,
  };
}
