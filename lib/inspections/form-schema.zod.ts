import { z } from 'zod';

const severitySchema = z.enum(['low', 'medium', 'high', 'critical']);

const answerConfigSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('measurement'),
    units: z.array(z.string().min(1)).min(1),
    defaultUnit: z.string().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
  }),
  z.object({ type: z.literal('yes_no'), correct: z.enum(['yes', 'no']) }),
  z.object({ type: z.literal('yes_no_na'), correct: z.enum(['yes', 'no', 'na']) }),
  z.object({ type: z.literal('free_text') }),
  z.object({
    type: z.literal('photo_set'),
    slots: z
      .array(z.object({ id: z.string(), label: z.string().min(1) }))
      .min(1)
      .max(8),
  }),
]);

const questionSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  imagePath: z.string().optional(),
  severity: severitySchema,
  answer: answerConfigSchema,
  comments: z.object({ photo: z.boolean(), text: z.boolean() }),
});

const sectionSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  questions: z.array(questionSchema),
});

export const formSchemaSchema = z.object({
  sections: z.array(sectionSchema),
});

export type FormSchemaInput = z.input<typeof formSchemaSchema>;
