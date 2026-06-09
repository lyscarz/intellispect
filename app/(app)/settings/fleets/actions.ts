'use server';

import { revalidatePath } from 'next/cache';
import { getSessionContext } from '@/lib/getSessionContext';
import { createFleet, deleteFleet, renameFleet } from '@/lib/fleets';
import type { Fleet } from '@/lib/types';

export async function createFleetAction(name: string): Promise<Fleet> {
  const ctx = await getSessionContext();
  const fleet = await createFleet(ctx.accountId, ctx.userId, name);
  revalidatePath('/fleet');
  revalidatePath('/sites');
  revalidatePath('/settings/fleets');
  return fleet;
}

export async function renameFleetAction(fleetId: string, newName: string): Promise<Fleet> {
  const ctx = await getSessionContext();
  const fleet = await renameFleet(fleetId, ctx.accountId, newName);
  revalidatePath('/fleet');
  revalidatePath('/sites');
  revalidatePath('/settings/fleets');
  return fleet;
}

export async function deleteFleetAction(fleetId: string): Promise<void> {
  const ctx = await getSessionContext();
  await deleteFleet(fleetId, ctx.accountId);
  revalidatePath('/fleet');
  revalidatePath('/sites');
  revalidatePath('/settings/fleets');
}
