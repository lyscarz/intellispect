import { createSupabaseServerClient } from '@/lib/supabase/server';
import { summariseFormRun } from './summarise';
import type {
  FormSchema,
  InspectionResponse,
  Outcome,
  ResponsePhoto,
  SubmittedAnswer,
  SubmittedComment,
} from './types';
import type { PhotoUploadRef, SubmitInspectionInput } from './response-schema.zod';

/** Derive a pass/attention/fail outcome from the form schema + answers.
 *   - fail       any mismatched yes/no(_na) on a high|critical question, OR
 *                a measurement that fell outside [min, max] on the same severity.
 *   - attention  any mismatch / out-of-range at medium severity, OR ANY mismatch
 *                where comments include a photo (operator flagged it).
 *   - pass       otherwise. */
export function deriveFormOutcome(
  schema: FormSchema,
  answers: Record<string, SubmittedAnswer>,
  comments: Record<string, SubmittedComment>
): Outcome {
  let worst: Outcome = 'pass';
  const bump = (o: Outcome) => {
    if (o === 'fail') worst = 'fail';
    else if (o === 'attention' && worst === 'pass') worst = 'attention';
  };

  for (const section of schema.sections) {
    for (const q of section.questions) {
      const a = answers[q.id];
      if (!a) continue;
      const sev = q.severity;
      const cfg = q.answer;

      let bad = false;
      if (cfg.type === 'yes_no' && a.type === 'yes_no') {
        bad = a.value !== null && a.value !== cfg.correct;
      } else if (cfg.type === 'yes_no_na' && a.type === 'yes_no_na') {
        bad = a.value !== null && a.value !== cfg.correct;
      } else if (cfg.type === 'measurement' && a.type === 'measurement') {
        if (a.value !== null) {
          if (cfg.min !== undefined && a.value < cfg.min) bad = true;
          if (cfg.max !== undefined && a.value > cfg.max) bad = true;
        }
      }

      if (!bad) continue;
      if (sev === 'high' || sev === 'critical') bump('fail');
      else if (sev === 'medium') bump('attention');
      else if (sev === 'low' && comments[q.id]?.hasPhoto) bump('attention');
    }
  }
  return worst;
}

const PHOTO_BUCKET = 'inspection-photos';
/** Signed URL lifetime when surfacing photos in the manager UI. */
const SIGNED_URL_TTL_SECONDS = 60 * 30; // 30 min

interface ResponseRow {
  id: string;
  account_id: string;
  template_id: string;
  template_snapshot: FormSchema;
  machine_id: string | null;
  site_id: string | null;
  submitted_by: string | null;
  submitted_at: string;
  answers: Record<string, SubmittedAnswer> | null;
  comments: Record<string, SubmittedComment> | null;
  status: string;
  outcome: string | null;
  summary: string | null;
  findings: unknown;
}

interface PhotoRow {
  id: string;
  response_id: string;
  account_id: string;
  question_id: string;
  slot_id: string | null;
  kind: 'answer' | 'comment';
  storage_path: string;
  content_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

function rowToResponse(r: ResponseRow): InspectionResponse {
  return {
    id: r.id,
    accountId: r.account_id,
    templateId: r.template_id,
    templateSnapshot: r.template_snapshot,
    machineId: r.machine_id,
    siteId: r.site_id,
    submittedBy: r.submitted_by,
    submittedAt: r.submitted_at,
    answers: r.answers ?? {},
    comments: r.comments ?? {},
    status: r.status,
    outcome: (r.outcome as Outcome) ?? null,
    summary: r.summary,
    findings: r.findings,
  };
}

function rowToPhoto(r: PhotoRow): ResponsePhoto {
  return {
    id: r.id,
    responseId: r.response_id,
    accountId: r.account_id,
    questionId: r.question_id,
    slotId: r.slot_id,
    kind: r.kind,
    storagePath: r.storage_path,
    contentType: r.content_type,
    sizeBytes: r.size_bytes,
    createdAt: r.created_at,
  };
}

export interface CreateResponseArgs {
  accountId: string;
  userId: string;
  templateSnapshot: FormSchema;
  templateName: string;
  input: SubmitInspectionInput;
}

/** Inserts the response row + photo rows, then runs a single-shot AI
 *  summariser and UPDATEs the row with the summary. The summary is best-effort:
 *  if the call fails, the response is still saved (without a summary). */
export async function createResponse(args: CreateResponseArgs): Promise<InspectionResponse> {
  const { accountId, userId, templateSnapshot, templateName, input } = args;
  const supabase = createSupabaseServerClient();

  const now = new Date().toISOString();
  const outcome = deriveFormOutcome(
    templateSnapshot,
    input.answers,
    input.comments ?? {}
  );
  const { data, error } = await supabase
    .from('inspection_responses')
    .insert({
      account_id: accountId,
      template_id: input.templateId,
      template_snapshot: templateSnapshot,
      machine_id: input.machineId ?? null,
      site_id: input.siteId ?? null,
      submitted_by: userId,
      answers: input.answers,
      comments: input.comments ?? {},
      status: 'complete',
      started_at: now,
      completed_at: now,
      preflight: input.preflight ?? null,
      engine_hours_at_start: input.engineHoursAtStart ?? null,
      operating_hours_at_start: input.operatingHoursAtStart ?? null,
      machine_state_at_start: input.machineStateAtStart ?? null,
      outcome,
    })
    .select('*')
    .single();
  if (error || !data) {
    throw new Error(`Failed to create inspection response: ${error?.message}`);
  }
  const response = rowToResponse(data as ResponseRow);

  const uploads = input.photoUploads ?? [];
  if (uploads.length > 0) {
    await attachPhotos(accountId, response.id, uploads);
  }

  // Best-effort AI summary. Failures should not block the submission.
  try {
    const summary = await summariseFormRun({
      templateName,
      schema: templateSnapshot,
      answers: input.answers,
      comments: input.comments ?? {},
    });
    await supabase
      .from('inspection_responses')
      .update({ summary })
      .eq('account_id', accountId)
      .eq('id', response.id);
  } catch (e) {
    console.error('[responses.createResponse] Summary failed:', (e as Error).message);
  }

  return response;
}

export async function attachPhotos(
  accountId: string,
  responseId: string,
  uploads: PhotoUploadRef[]
): Promise<void> {
  if (uploads.length === 0) return;
  const supabase = createSupabaseServerClient();
  const rows = uploads.map((u) => ({
    response_id: responseId,
    account_id: accountId,
    question_id: u.questionId,
    slot_id: u.slotId ?? null,
    kind: u.kind,
    storage_path: u.storagePath,
    content_type: u.contentType ?? null,
    size_bytes: u.sizeBytes ?? null,
  }));
  const { error } = await supabase.from('inspection_response_photos').insert(rows);
  if (error) throw new Error(`Failed to attach photos: ${error.message}`);
}

export interface ListResponsesFilters {
  templateId?: string;
  machineId?: string;
  siteId?: string;
  /** ISO timestamp — only responses submitted at or after this point. */
  since?: string;
  limit?: number;
  /** Fleet-scope filter. null/undefined = unrestricted; [] = none. */
  allowedFleetIds?: string[] | null;
}

export async function listResponses(
  accountId: string,
  filters: ListResponsesFilters = {}
): Promise<InspectionResponse[]> {
  const supabase = createSupabaseServerClient();

  // Resolve fleet scope to a machine-id whitelist first.
  let scopedMachineIds: string[] | null = null;
  if (filters.allowedFleetIds != null) {
    if (filters.allowedFleetIds.length === 0) return [];
    const { data: ms, error: msErr } = await supabase
      .from('machines')
      .select('id')
      .eq('account_id', accountId)
      .in('fleet_id', filters.allowedFleetIds);
    if (msErr) throw new Error(`Failed to resolve scoped machines: ${msErr.message}`);
    scopedMachineIds = (ms ?? []).map((m) => (m as { id: string }).id);
    if (scopedMachineIds.length === 0) return [];
  }

  let q = supabase
    .from('inspection_responses')
    .select('*')
    .eq('account_id', accountId)
    .order('submitted_at', { ascending: false });
  if (scopedMachineIds) q = q.in('machine_id', scopedMachineIds);
  if (filters.templateId) q = q.eq('template_id', filters.templateId);
  if (filters.machineId) q = q.eq('machine_id', filters.machineId);
  if (filters.siteId) q = q.eq('site_id', filters.siteId);
  if (filters.since) q = q.gte('submitted_at', filters.since);
  if (filters.limit) q = q.limit(filters.limit);

  const { data, error } = await q;
  if (error) throw new Error(`Failed to list responses: ${error.message}`);
  return (data ?? []).map((r) => rowToResponse(r as ResponseRow));
}

/** Loads one response with all photos AND fresh signed URLs for each. */
export async function getResponse(
  accountId: string,
  id: string
): Promise<InspectionResponse | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('inspection_responses')
    .select('*')
    .eq('account_id', accountId)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`Failed to load response: ${error.message}`);
  if (!data) return null;
  const response = rowToResponse(data as ResponseRow);

  const { data: photoData, error: photoErr } = await supabase
    .from('inspection_response_photos')
    .select('*')
    .eq('account_id', accountId)
    .eq('response_id', id)
    .order('created_at', { ascending: true });
  if (photoErr) throw new Error(`Failed to load response photos: ${photoErr.message}`);

  const photos = (photoData ?? []).map((r) => rowToPhoto(r as PhotoRow));
  if (photos.length > 0) {
    const { data: signed, error: signErr } = await supabase.storage
      .from(PHOTO_BUCKET)
      .createSignedUrls(photos.map((p) => p.storagePath), SIGNED_URL_TTL_SECONDS);
    if (signErr) {
      // Surface broken signing as null URLs rather than 500ing the page.
      console.error(`[responses.getResponse] Signed URL batch failed: ${signErr.message}`);
    } else if (signed) {
      for (let i = 0; i < photos.length; i++) {
        photos[i].signedUrl = signed[i]?.signedUrl ?? undefined;
      }
    }
  }
  response.photos = photos;
  return response;
}

/** Counts responses for one template — used in the inspections list to show
 *  "n submissions" next to each template. */
export async function countResponsesByTemplate(
  accountId: string,
  templateIds: string[]
): Promise<Record<string, number>> {
  if (templateIds.length === 0) return {};
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from('inspection_responses')
    .select('template_id')
    .eq('account_id', accountId)
    .in('template_id', templateIds);
  if (error) throw new Error(`Failed to count responses: ${error.message}`);
  const out: Record<string, number> = {};
  for (const row of (data ?? []) as { template_id: string }[]) {
    out[row.template_id] = (out[row.template_id] ?? 0) + 1;
  }
  return out;
}
