'use server';

import { revalidatePath } from 'next/cache';
import { getSessionContext } from '@/lib/getSessionContext';
import {
  createEscalation,
  resolveEscalation,
  type CreateEscalationInput,
} from '@/lib/inspections/escalations';

/** Create an escalation tied to either a form response or an intent run. */
export async function createEscalationAction(input: CreateEscalationInput): Promise<void> {
  const ctx = await getSessionContext();
  await createEscalation(ctx.accountId, ctx.userId, input);
  revalidatePath('/inspection-history');
  if (input.responseId) {
    revalidatePath(`/inspection-history/form/${input.responseId}`);
  }
  if (input.intentRunId) {
    revalidatePath(`/inspection-history/intent/${input.intentRunId}`);
  }
}

export async function resolveEscalationAction(id: string, runHref?: string): Promise<void> {
  const ctx = await getSessionContext();
  await resolveEscalation(ctx.accountId, id);
  revalidatePath('/inspection-history');
  if (runHref) revalidatePath(runHref);
}
