import { getOpenAI, MODEL } from './llm';
import { FORM_SUMMARY_SYSTEM_PROMPT } from './prompts';
import type {
  FormSchema,
  SubmittedAnswer,
  SubmittedComment,
} from './types';

interface SummariseFormInput {
  templateName: string;
  schema: FormSchema;
  answers: Record<string, SubmittedAnswer>;
  comments: Record<string, SubmittedComment>;
}

/** One-shot, non-streaming summary of a completed form inspection. Returns a
 *  short paragraph the pre-flight resolver can surface to the next inspection. */
export async function summariseFormRun(input: SummariseFormInput): Promise<string> {
  const openai = getOpenAI();

  // Render the form + answers as compact JSON so the model can see both.
  const payload = {
    templateName: input.templateName,
    questions: input.schema.sections.flatMap((sec) =>
      sec.questions.map((q) => ({
        id: q.id,
        section: sec.name,
        title: q.title,
        severity: q.severity,
        answer: input.answers[q.id] ?? null,
        comment: input.comments[q.id] ?? null,
      }))
    ),
  };

  const completion = await openai.chat.completions.create({
    model: MODEL,
    max_tokens: 400,
    messages: [
      { role: 'system', content: FORM_SUMMARY_SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify(payload) },
    ],
  });

  const text = completion.choices[0]?.message?.content?.trim();
  return text || 'Inspection completed.';
}
