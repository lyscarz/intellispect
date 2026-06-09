'use server';

import { randomUUID } from 'crypto';
import { getSessionContext } from '@/lib/getSessionContext';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getTemplate } from './repo';
import { createResponse } from './responses';
import { submitInspectionInputSchema } from './response-schema.zod';
import type { SubmitInspectionInput } from './response-schema.zod';

const PHOTO_BUCKET = 'inspection-photos';

const EXT_BY_CONTENT_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg':  'jpg',
  'image/png':  'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/gif':  'gif',
};

function extFor(contentType: string | undefined): string {
  if (!contentType) return 'bin';
  return EXT_BY_CONTENT_TYPE[contentType.toLowerCase()] ?? 'bin';
}

export interface PhotoSlotRequest {
  /** Client-side identifier so the response can pair the signed URL back up
   *  with the file (e.g. `${questionId}:${slotId ?? 'comment'}`). */
  clientId: string;
  contentType?: string;
}

export interface PhotoSlotResponse {
  clientId: string;
  storagePath: string;
  /** Use with `supabase.storage.from(bucket).uploadToSignedUrl(path, token, file)`. */
  token: string;
  signedUrl: string;
}

/** Mints one-time signed upload URLs for the browser to PUT photos to. The
 *  client passes the resulting storagePaths back in `submitInspectionAction`. */
export async function createPhotoUploadUrlsAction(
  photos: PhotoSlotRequest[]
): Promise<PhotoSlotResponse[]> {
  if (photos.length === 0) return [];
  const ctx = await getSessionContext();
  const supabase = createSupabaseServerClient();

  const out: PhotoSlotResponse[] = [];
  for (const p of photos) {
    const path = `${ctx.accountId}/${randomUUID()}.${extFor(p.contentType)}`;
    const { data, error } = await supabase.storage
      .from(PHOTO_BUCKET)
      .createSignedUploadUrl(path);
    if (error || !data) {
      throw new Error(`Failed to create signed upload URL: ${error?.message}`);
    }
    out.push({
      clientId: p.clientId,
      storagePath: data.path,
      token: data.token,
      signedUrl: data.signedUrl,
    });
  }
  return out;
}

export interface SubmitInspectionResult {
  responseId: string;
}

/** Writes the response + photo rows. Photos must already be uploaded to
 *  Storage (paths from `createPhotoUploadUrlsAction`). */
export async function submitInspectionAction(
  raw: SubmitInspectionInput
): Promise<SubmitInspectionResult> {
  const parsed = submitInspectionInputSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Invalid submission: ${parsed.error.message}`);
  }
  const input = parsed.data;

  const ctx = await getSessionContext();
  const template = await getTemplate(ctx.accountId, input.templateId);
  if (!template) throw new Error('Template not found');
  if (template.kind !== 'form' || !template.form_schema) {
    throw new Error('Only form templates can be submitted this way');
  }

  const response = await createResponse({
    accountId: ctx.accountId,
    userId: ctx.userId,
    templateSnapshot: template.form_schema,
    templateName: template.name,
    input,
  });
  return { responseId: response.id };
}
