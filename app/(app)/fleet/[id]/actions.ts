'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getSessionContext } from '@/lib/getSessionContext';
import { deleteMachine, getMachine, updateMachine } from '@/lib/machines';
import { deleteMachineImage, uploadMachineImage } from '@/lib/storage';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getActiveTrackunitClient } from '@/lib/telematics/get-client';
import { fetchAssetWith } from '@/lib/trackunit-api';

export async function updateMachineAction(machineId: string, formData: FormData) {
  const ctx = await getSessionContext();

  const name = (formData.get('name') as string | null)?.trim();
  if (!name) {
    redirect(`/fleet/${machineId}?error=` + encodeURIComponent('Name is required'));
  }

  const brand = ((formData.get('brand') as string | null) ?? '').trim() || null;
  const model = ((formData.get('model') as string | null) ?? '').trim() || null;
  const serialNumber = ((formData.get('serial_number') as string | null) ?? '').trim() || null;
  const site = ((formData.get('site') as string | null) ?? '').trim() || null;
  const fleetIdRaw = formData.get('fleet_id') as string | null;
  const siteIdRaw = formData.get('site_id') as string | null;
  const fleetId = fleetIdRaw === null ? undefined : fleetIdRaw.trim() || null;
  const siteId = siteIdRaw === null ? undefined : siteIdRaw.trim() || null;
  const image = formData.get('image') as File | null;

  let imagePath: string | undefined;
  if (image && image.size > 0) {
    try {
      imagePath = await uploadMachineImage(ctx.accountId, machineId, image);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to upload image';
      redirect(`/fleet/${machineId}?error=` + encodeURIComponent(msg));
    }
  }

  try {
    await updateMachine(machineId, ctx.accountId, {
      name: name!,
      brand,
      model,
      serialNumber,
      site,
      fleetId,
      siteId,
      ...(imagePath !== undefined ? { imagePath } : {}),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to update machine';
    redirect(`/fleet/${machineId}?error=` + encodeURIComponent(msg));
  }

  revalidatePath('/fleet');
  revalidatePath(`/fleet/${machineId}`);
  redirect('/fleet');
}

/**
 * Disconnect or delete depending on machine source/status:
 *  - manual → hard-delete (and remove image)
 *  - trackunit + active → soft-disconnect (status = 'disconnected'); last snapshot survives
 *  - trackunit + disconnected → hard-delete (the "Remove permanently" case)
 */
export async function disconnectOrDeleteAction(machineId: string) {
  const ctx = await getSessionContext();
  const machine = await getMachine(machineId, ctx.accountId);
  if (!machine) redirect('/fleet');

  if (machine!.source === 'manual' || machine!.status === 'disconnected') {
    try {
      await deleteMachine(machineId, ctx.accountId);
      if (machine!.imagePath) await deleteMachineImage(machine!.imagePath);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete machine';
      redirect(`/fleet/${machineId}?error=` + encodeURIComponent(msg));
    }
  } else {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase
      .from('machines')
      .update({ status: 'disconnected' })
      .eq('id', machineId)
      .eq('account_id', ctx.accountId);
    if (error) {
      redirect(`/fleet/${machineId}?error=` + encodeURIComponent(error.message));
    }
  }

  revalidatePath('/fleet');
  redirect('/fleet');
}

export async function refreshSnapshotAction(machineId: string) {
  const ctx = await getSessionContext();
  const machine = await getMachine(machineId, ctx.accountId);
  if (!machine) redirect('/fleet');
  if (machine!.source !== 'trackunit' || !machine!.sourceExternalId) {
    redirect(`/fleet/${machineId}?error=` + encodeURIComponent('Not a Trackunit machine'));
  }

  const client = await getActiveTrackunitClient(ctx.accountId);
  if (!client) {
    redirect(`/fleet/${machineId}?error=` + encodeURIComponent('No active Trackunit connection'));
  }

  try {
    const snapshot = await fetchAssetWith(client!.provider, machine!.sourceExternalId!);
    if (!snapshot) {
      redirect(`/fleet/${machineId}?error=` + encodeURIComponent('Asset not found in Trackunit'));
    }
    const supabase = createSupabaseServerClient();
    const { error } = await supabase
      .from('machines')
      .update({ last_snapshot: snapshot, last_synced_at: new Date().toISOString() })
      .eq('id', machineId)
      .eq('account_id', ctx.accountId);
    if (error) {
      redirect(`/fleet/${machineId}?error=` + encodeURIComponent(error.message));
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Refresh failed';
    redirect(`/fleet/${machineId}?error=` + encodeURIComponent(msg));
  }

  revalidatePath('/fleet');
  revalidatePath(`/fleet/${machineId}`);
  redirect(`/fleet/${machineId}?refreshed=1`);
}
