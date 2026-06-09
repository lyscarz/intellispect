import { createSupabaseServerClient } from '@/lib/supabase/server';
import type {
  ChatMessage,
  FormSchema,
  InspectionKind,
  InspectionStatus,
  InspectionTemplate,
} from './types';

interface Row {
  id: string;
  account_id: string;
  kind: InspectionKind;
  status: InspectionStatus;
  name: string;
  handle: string;
  description: string | null;
  form_schema: FormSchema | null;
  yaml_body: string | null;
  chat_history: ChatMessage[] | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

function rowToTemplate(r: Row): InspectionTemplate {
  return { ...r, chat_history: r.chat_history ?? [] };
}

export function normaliseHandle(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^\/+/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function listTemplates(accountId: string): Promise<InspectionTemplate[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('inspection_templates')
    .select('*')
    .eq('account_id', accountId)
    .order('updated_at', { ascending: false });
  if (error) throw new Error(`Failed to list inspections: ${error.message}`);
  return (data ?? []).map((r) => rowToTemplate(r as Row));
}

export async function getTemplate(
  accountId: string,
  id: string
): Promise<InspectionTemplate | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('inspection_templates')
    .select('*')
    .eq('account_id', accountId)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`Failed to load inspection: ${error.message}`);
  return data ? rowToTemplate(data as Row) : null;
}

export interface CreateInput {
  kind: InspectionKind;
  name: string;
  handle: string;
  formSchema?: FormSchema;
  yamlBody?: string;
}

export async function createTemplate(
  accountId: string,
  userId: string,
  input: CreateInput
): Promise<InspectionTemplate> {
  const name = input.name.trim();
  if (!name) throw new Error('Name is required');
  const handle = normaliseHandle(input.handle);
  if (!handle) throw new Error('Handle is required');

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('inspection_templates')
    .insert({
      account_id: accountId,
      created_by: userId,
      kind: input.kind,
      name,
      handle,
      form_schema: input.kind === 'form' ? input.formSchema ?? { sections: [] } : null,
      yaml_body: input.kind === 'intent' ? input.yamlBody ?? '' : null,
      chat_history: [],
    })
    .select('*')
    .single();
  if (error || !data) {
    if (error?.code === '23505') throw new Error(`Handle "/${handle}" is already in use`);
    throw new Error(`Failed to create inspection: ${error?.message}`);
  }
  return rowToTemplate(data as Row);
}

export interface UpdateInput {
  name?: string;
  handle?: string;
  description?: string | null;
  status?: InspectionStatus;
  formSchema?: FormSchema;
  yamlBody?: string;
  chatHistory?: ChatMessage[];
}

export async function updateTemplate(
  accountId: string,
  id: string,
  input: UpdateInput
): Promise<InspectionTemplate> {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const n = input.name.trim();
    if (!n) throw new Error('Name is required');
    patch.name = n;
  }
  if (input.handle !== undefined) {
    const h = normaliseHandle(input.handle);
    if (!h) throw new Error('Handle is required');
    patch.handle = h;
  }
  if (input.description !== undefined) patch.description = input.description;
  if (input.status !== undefined) patch.status = input.status;
  if (input.formSchema !== undefined) patch.form_schema = input.formSchema;
  if (input.yamlBody !== undefined) patch.yaml_body = input.yamlBody;
  if (input.chatHistory !== undefined) patch.chat_history = input.chatHistory;

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('inspection_templates')
    .update(patch)
    .eq('account_id', accountId)
    .eq('id', id)
    .select('*')
    .single();
  if (error || !data) {
    if (error?.code === '23505') throw new Error('Handle is already in use');
    throw new Error(`Failed to update inspection: ${error?.message}`);
  }
  return rowToTemplate(data as Row);
}

export async function deleteTemplate(accountId: string, id: string): Promise<void> {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from('inspection_templates')
    .delete()
    .eq('account_id', accountId)
    .eq('id', id);
  if (error) throw new Error(`Failed to delete inspection: ${error.message}`);
}
