import { createSupabaseServerClient } from './supabase/server';

const BUCKET = 'machine-images';

/** Upload an image for a machine. Returns the storage object path. */
export async function uploadMachineImage(
  accountId: string,
  machineId: string,
  file: File
): Promise<string> {
  const supabase = createSupabaseServerClient();
  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `${accountId}/${machineId}.${ext || 'jpg'}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || 'image/jpeg',
  });
  if (error) throw new Error(`Failed to upload image: ${error.message}`);
  return path;
}

/** Generate a signed URL (1 hour) for a stored image path. */
export async function getSignedImageUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/** Generate signed URLs for several paths at once. */
export async function getSignedImageUrls(paths: (string | null)[]): Promise<(string | null)[]> {
  return Promise.all(paths.map(getSignedImageUrl));
}

/** Delete an image. Best-effort — failures are logged but not thrown. */
export async function deleteMachineImage(path: string | null): Promise<void> {
  if (!path) return;
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) console.error(`[storage] failed to delete ${path}:`, error.message);
}
