'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getSessionContext } from '@/lib/getSessionContext';
import { createManualMachine, updateMachine } from '@/lib/machines';
import { uploadMachineImage } from '@/lib/storage';

export async function createManualMachineAction(formData: FormData) {
  const ctx = await getSessionContext();

  const name = (formData.get('name') as string | null)?.trim();
  if (!name) {
    redirect('/fleet/new?error=' + encodeURIComponent('Name is required'));
  }

  const brand = ((formData.get('brand') as string | null) ?? '').trim() || null;
  const model = ((formData.get('model') as string | null) ?? '').trim() || null;
  const serialNumber = ((formData.get('serial_number') as string | null) ?? '').trim() || null;
  const site = ((formData.get('site') as string | null) ?? '').trim() || null;
  const fleetId = ((formData.get('fleet_id') as string | null) ?? '').trim() || null;
  const siteId = ((formData.get('site_id') as string | null) ?? '').trim() || null;
  const image = formData.get('image') as File | null;

  let machine;
  try {
    machine = await createManualMachine(ctx.accountId, ctx.userId, {
      name: name!,
      brand,
      model,
      serialNumber,
      site,
      fleetId,
      siteId,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to create machine';
    redirect('/fleet/new?error=' + encodeURIComponent(msg));
  }

  if (image && image.size > 0) {
    try {
      const path = await uploadMachineImage(ctx.accountId, machine.id, image);
      await updateMachine(machine.id, ctx.accountId, { imagePath: path });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to upload image';
      // Machine was created — surface the error but keep the row.
      redirect(`/fleet/${machine.id}?error=` + encodeURIComponent(msg));
    }
  }

  revalidatePath('/fleet');
  redirect('/fleet');
}
