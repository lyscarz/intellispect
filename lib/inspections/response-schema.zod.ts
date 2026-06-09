import { z } from 'zod';

const submittedAnswerSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('measurement'),
    value: z.number().nullable(),
    unit: z.string(),
  }),
  z.object({ type: z.literal('yes_no'),    value: z.enum(['yes', 'no']).nullable() }),
  z.object({ type: z.literal('yes_no_na'), value: z.enum(['yes', 'no', 'na']).nullable() }),
  z.object({ type: z.literal('free_text'), value: z.string() }),
  z.object({ type: z.literal('photo_set'), filledSlots: z.array(z.string()) }),
]);

const submittedCommentSchema = z.object({
  text: z.string().optional(),
  hasPhoto: z.boolean().optional(),
});

export const photoUploadSchema = z.object({
  questionId: z.string().min(1),
  slotId: z.string().nullable().optional(),
  kind: z.enum(['answer', 'comment']),
  storagePath: z.string().min(1),
  contentType: z.string().optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
});

const preflightVerdictSchema = z.object({
  recommendation: z.enum(['proceed', 'heightened', 'skip']),
  reasoning: z.string(),
  briefing: z.string(),
  focusItems: z.array(z.string()).optional(),
});

export const submitInspectionInputSchema = z.object({
  templateId: z.string().uuid(),
  machineId: z.string().uuid().nullable().optional(),
  siteId: z.string().uuid().nullable().optional(),
  answers: z.record(z.string(), submittedAnswerSchema),
  comments: z.record(z.string(), submittedCommentSchema).optional(),
  photoUploads: z.array(photoUploadSchema).optional(),
  /** Pre-flight verdict produced before the inspection ran. */
  preflight: preflightVerdictSchema.optional(),
  /** Telematics snapshot captured at run start. */
  engineHoursAtStart: z.number().nullable().optional(),
  operatingHoursAtStart: z.number().nullable().optional(),
  machineStateAtStart: z.unknown().optional(),
});

export type SubmitInspectionInput = z.infer<typeof submitInspectionInputSchema>;
export type PhotoUploadRef = z.infer<typeof photoUploadSchema>;
