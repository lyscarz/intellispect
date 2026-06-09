'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSessionContext } from '@/lib/getSessionContext';
import { formSchemaSchema } from '@/lib/inspections/form-schema.zod';
import {
  createTemplate,
  deleteTemplate,
  updateTemplate,
  type UpdateInput,
} from '@/lib/inspections/repo';
import {
  addAssignment,
  removeAssignment,
  type AddAssignmentInput,
} from '@/lib/inspections/assignments';
import { emptyIntentYaml, validateIntentYaml } from '@/lib/inspections/yaml-schema';
import type { InspectionKind, InspectionStatus, FormSchema } from '@/lib/inspections/types';

export async function createTemplateAction(
  kind: InspectionKind,
  name: string,
  handle: string
): Promise<void> {
  const ctx = await getSessionContext();
  const tpl = await createTemplate(ctx.accountId, ctx.userId, {
    kind,
    name,
    handle,
    formSchema: kind === 'form' ? { sections: [] } : undefined,
    yamlBody: kind === 'intent' ? emptyIntentYaml(handle) : undefined,
  });
  // Default new templates to assigned-to-all so they're ad-hoc runnable on
  // any machine straight away. Authors can narrow scope from the
  // AssignmentPanel later.
  await addAssignment(ctx.accountId, ctx.userId, {
    templateId: tpl.id,
    targetKind: 'all',
  });
  revalidatePath('/inspections');
  redirect(`/inspections/${tpl.id}`);
}

export async function updateMetaAction(
  id: string,
  patch: { name?: string; handle?: string; description?: string | null; status?: InspectionStatus }
): Promise<void> {
  const ctx = await getSessionContext();
  await updateTemplate(ctx.accountId, id, patch);
  revalidatePath('/inspections');
  revalidatePath(`/inspections/${id}`);
}

export async function saveFormSchemaAction(id: string, schema: FormSchema): Promise<void> {
  const ctx = await getSessionContext();
  const parsed = formSchemaSchema.safeParse(schema);
  if (!parsed.success) throw new Error(`Invalid form schema: ${parsed.error.message}`);
  await updateTemplate(ctx.accountId, id, { formSchema: parsed.data as FormSchema });
  revalidatePath(`/inspections/${id}`);
}

export async function saveYamlAction(id: string, yamlBody: string): Promise<void> {
  const ctx = await getSessionContext();
  const v = validateIntentYaml(yamlBody);
  if (!v.ok) throw new Error(v.error);
  await updateTemplate(ctx.accountId, id, { yamlBody });
  revalidatePath(`/inspections/${id}`);
}

export async function deleteTemplateAction(id: string): Promise<void> {
  const ctx = await getSessionContext();
  await deleteTemplate(ctx.accountId, id);
  revalidatePath('/inspections');
  redirect('/inspections');
}

export async function updateAction(id: string, patch: UpdateInput): Promise<void> {
  const ctx = await getSessionContext();
  await updateTemplate(ctx.accountId, id, patch);
  revalidatePath('/inspections');
  revalidatePath(`/inspections/${id}`);
}

export async function addAssignmentAction(input: AddAssignmentInput): Promise<void> {
  const ctx = await getSessionContext();
  await addAssignment(ctx.accountId, ctx.userId, input);
  revalidatePath(`/inspections/${input.templateId}`);
  revalidatePath('/inspections/test');
}

export async function removeAssignmentAction(templateId: string, assignmentId: string): Promise<void> {
  const ctx = await getSessionContext();
  await removeAssignment(ctx.accountId, assignmentId);
  revalidatePath(`/inspections/${templateId}`);
  revalidatePath('/inspections/test');
}
