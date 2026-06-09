'use server';

import { revalidatePath } from 'next/cache';
import { getSessionContext } from '@/lib/getSessionContext';
import { createSite, deleteSite, getSite, updateSite } from '@/lib/sites';
import type { Site } from '@/lib/types';

export async function createSiteAction(
  fleetId: string,
  name: string,
  address: string | null
): Promise<Site> {
  const ctx = await getSessionContext();
  const site = await createSite(ctx.accountId, ctx.userId, { fleetId, name, address });
  revalidatePath('/sites');
  revalidatePath('/fleet');
  return site;
}

/**
 * Reject mutations on Trackunit-sourced sites. The next cron tick would
 * overwrite a rename and recreate a deletion, so allowing the mutation would
 * just thrash data. The UI also disables these buttons — this is the server
 * guardrail.
 */
async function assertNotTrackunitSourced(siteId: string, accountId: string): Promise<void> {
  const site = await getSite(siteId, accountId);
  if (!site) throw new Error('Site not found');
  if (site.source === 'trackunit') {
    throw new Error(
      'This site is managed by Trackunit and is read-only here. Change it in Trackunit Manager.'
    );
  }
}

export async function updateSiteAction(
  siteId: string,
  name: string,
  address: string | null
): Promise<Site> {
  const ctx = await getSessionContext();
  await assertNotTrackunitSourced(siteId, ctx.accountId);
  const site = await updateSite(siteId, ctx.accountId, { name, address });
  revalidatePath('/sites');
  revalidatePath('/fleet');
  return site;
}

export async function deleteSiteAction(siteId: string): Promise<void> {
  const ctx = await getSessionContext();
  await assertNotTrackunitSourced(siteId, ctx.accountId);
  await deleteSite(siteId, ctx.accountId);
  revalidatePath('/sites');
  revalidatePath('/fleet');
}
