'use client';

import { useState } from 'react';
import type {
  AnswerConfig,
  InspectionTemplate,
  MachineContext,
  PreflightVerdict,
  Question,
  RuntimeAnswer as Answer,
  RuntimeComment as Comment,
  Section,
  Severity,
  SubmittedAnswer,
  SubmittedComment,
} from '@/lib/inspections/types';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import {
  createPhotoUploadUrlsAction,
  submitInspectionAction,
} from '@/lib/inspections/run-actions';
import { MachineChip } from './MachineChip';

type AnswersState = Record<string, Answer>;
type CommentsState = Record<string, Comment>;

type Phase = 'editing' | 'uploading' | 'saving' | 'done' | 'error';

const PHOTO_BUCKET = 'inspection-photos';

const SEVERITY_BAR: Record<Severity, string> = {
  low: 'bg-slate-300',
  medium: 'bg-amber-400',
  high: 'bg-orange-500',
  critical: 'bg-rose-500',
};

function initialAnswer(cfg: AnswerConfig): Answer {
  switch (cfg.type) {
    case 'measurement':
      return { type: 'measurement', value: '', unit: cfg.defaultUnit ?? cfg.units[0] ?? '' };
    case 'yes_no':
      return { type: 'yes_no', value: null };
    case 'yes_no_na':
      return { type: 'yes_no_na', value: null };
    case 'free_text':
      return { type: 'free_text', value: '' };
    case 'photo_set':
      return {
        type: 'photo_set',
        photos: Object.fromEntries(cfg.slots.map((s) => [s.id, null])),
      };
  }
}

export function MobileFormRunner({
  template,
  machine = null,
  siteId = null,
  briefing = null,
  preflight = null,
  onSubmitted,
}: {
  template: InspectionTemplate;
  machine?: MachineContext | null;
  siteId?: string | null;
  /** Short briefing from the pre-flight AI. Rendered as a banner inside the
   *  phone frame and forwarded into the persisted response. */
  briefing?: string | null;
  /** Pre-flight verdict, persisted alongside the response on submit. */
  preflight?: PreflightVerdict | null;
  /** When provided, the runner persists the response to Supabase and calls
   *  this with the new responseId. When omitted (in-builder preview), the
   *  submit is a no-op confirmation screen. */
  onSubmitted?: (responseId: string) => void;
}) {
  const schema = template.form_schema ?? { sections: [] };
  const [answers, setAnswers] = useState<AnswersState>(() => {
    const init: AnswersState = {};
    for (const s of schema.sections) for (const q of s.questions) init[q.id] = initialAnswer(q.answer);
    return init;
  });
  const [comments, setComments] = useState<CommentsState>({});
  const [phase, setPhase] = useState<Phase>('editing');
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  const totalQs = schema.sections.reduce((n, s) => n + s.questions.length, 0);
  const isPreview = !onSubmitted;

  if (schema.sections.length === 0) {
    return <EmptyMobile message="No sections yet. Add some questions in the builder." />;
  }

  if (phase === 'done') {
    return (
      <div className="p-5 text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-2">
          <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="font-semibold text-slate-900">Inspection complete</div>
        <p className="text-xs text-slate-500 mt-1">
          {isPreview
            ? 'Answers captured locally. In production this would submit to the fleet manager.'
            : 'Submitted to the fleet manager.'}
        </p>
        {isPreview && (
          <button
            type="button"
            onClick={() => setPhase('editing')}
            className="mt-3 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs"
          >
            Start over
          </button>
        )}
      </div>
    );
  }

  async function handleSubmit() {
    setError(null);

    if (isPreview) {
      setPhase('done');
      return;
    }

    try {
      // 1. Collect every File we need to upload, with a stable clientId.
      const photoFiles = collectPhotoFiles(schema.sections, answers, comments);

      // 2. Ask the server for signed upload URLs.
      let urlsByClientId: Record<string, { storagePath: string; token: string; signedUrl: string }> = {};
      if (photoFiles.length > 0) {
        setPhase('uploading');
        setUploadProgress({ done: 0, total: photoFiles.length });
        const urls = await createPhotoUploadUrlsAction(
          photoFiles.map((p) => ({ clientId: p.clientId, contentType: p.file.type || undefined }))
        );
        urlsByClientId = Object.fromEntries(urls.map((u) => [u.clientId, u]));

        // 3. Upload in parallel.
        const supabase = createSupabaseBrowserClient();
        let completed = 0;
        await Promise.all(
          photoFiles.map(async (p) => {
            const slot = urlsByClientId[p.clientId];
            if (!slot) throw new Error(`No upload slot returned for ${p.clientId}`);
            const { error: upErr } = await supabase.storage
              .from(PHOTO_BUCKET)
              .uploadToSignedUrl(slot.storagePath, slot.token, p.file, {
                contentType: p.file.type || 'application/octet-stream',
              });
            if (upErr) throw new Error(`Photo upload failed: ${upErr.message}`);
            completed++;
            setUploadProgress({ done: completed, total: photoFiles.length });
          })
        );
      }

      // 4. Serialise answers + comments, build photoUploads list, call submit.
      setPhase('saving');
      const submittedAnswers = toSubmittedAnswers(schema, answers);
      const submittedComments = toSubmittedComments(comments);
      const photoUploads = photoFiles.map((p) => {
        const slot = urlsByClientId[p.clientId];
        return {
          questionId: p.questionId,
          slotId: p.slotId ?? null,
          kind: p.kind,
          storagePath: slot.storagePath,
          contentType: p.file.type || undefined,
          sizeBytes: p.file.size,
        };
      });

      const { responseId } = await submitInspectionAction({
        templateId: template.id,
        machineId: machine?.id ?? null,
        siteId: siteId ?? null,
        answers: submittedAnswers,
        comments: submittedComments,
        photoUploads,
        preflight: preflight ?? undefined,
      });

      setPhase('done');
      onSubmitted?.(responseId);
    } catch (e) {
      setError((e as Error).message);
      setPhase('error');
    }
  }

  const submitting = phase === 'uploading' || phase === 'saving';

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3">
      <MachineChip machine={machine} />
      {briefing && (
        <div className="mt-2 rounded-lg bg-indigo-50 border border-indigo-100 px-2.5 py-1.5 text-[11px] text-indigo-900">
          {briefing}
        </div>
      )}
      <div className="mb-3 mt-3">
        <div className="text-xs uppercase tracking-wide text-slate-400 font-semibold">
          Inspection
        </div>
        <div className="text-base font-bold text-slate-900">{template.name}</div>
        <div className="text-[11px] text-slate-500">{totalQs} questions</div>
      </div>

      <div className="space-y-4">
        {schema.sections.map((sec) => (
          <SectionView
            key={sec.id}
            sec={sec}
            answers={answers}
            comments={comments}
            onAnswer={(qid, a) => setAnswers((s) => ({ ...s, [qid]: a }))}
            onComment={(qid, c) => setComments((s) => ({ ...s, [qid]: { ...s[qid], ...c } }))}
          />
        ))}
      </div>

      {error && (
        <div className="mt-3 rounded-md bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className="mt-5 w-full py-3 rounded-xl bg-brand-600 text-white text-sm font-semibold disabled:opacity-60"
      >
        {phase === 'uploading'
          ? `Uploading ${uploadProgress.done}/${uploadProgress.total} photos…`
          : phase === 'saving'
            ? 'Saving…'
            : 'Submit inspection'}
      </button>
    </div>
  );
}

interface PhotoFileRef {
  clientId: string;
  questionId: string;
  slotId: string | null;
  kind: 'answer' | 'comment';
  file: File;
}

function collectPhotoFiles(
  sections: Section[],
  answers: AnswersState,
  comments: CommentsState
): PhotoFileRef[] {
  const out: PhotoFileRef[] = [];
  for (const sec of sections) {
    for (const q of sec.questions) {
      const a = answers[q.id];
      if (a?.type === 'photo_set') {
        for (const [slotId, file] of Object.entries(a.photos)) {
          if (file) {
            out.push({
              clientId: `${q.id}:${slotId}`,
              questionId: q.id,
              slotId,
              kind: 'answer',
              file,
            });
          }
        }
      }
      const c = comments[q.id];
      if (c?.photo) {
        out.push({
          clientId: `${q.id}:__comment`,
          questionId: q.id,
          slotId: null,
          kind: 'comment',
          file: c.photo,
        });
      }
    }
  }
  return out;
}

function toSubmittedAnswers(
  schema: { sections: Section[] },
  answers: AnswersState
): Record<string, SubmittedAnswer> {
  const out: Record<string, SubmittedAnswer> = {};
  for (const sec of schema.sections) {
    for (const q of sec.questions) {
      const a = answers[q.id];
      if (!a) continue;
      switch (a.type) {
        case 'measurement':
          out[q.id] = {
            type: 'measurement',
            value: a.value === '' ? null : Number(a.value),
            unit: a.unit,
          };
          break;
        case 'yes_no':
          out[q.id] = { type: 'yes_no', value: a.value };
          break;
        case 'yes_no_na':
          out[q.id] = { type: 'yes_no_na', value: a.value };
          break;
        case 'free_text':
          out[q.id] = { type: 'free_text', value: a.value };
          break;
        case 'photo_set':
          out[q.id] = {
            type: 'photo_set',
            filledSlots: Object.entries(a.photos)
              .filter(([, f]) => !!f)
              .map(([slotId]) => slotId),
          };
          break;
      }
    }
  }
  return out;
}

function toSubmittedComments(comments: CommentsState): Record<string, SubmittedComment> {
  const out: Record<string, SubmittedComment> = {};
  for (const [qid, c] of Object.entries(comments)) {
    const text = c.text?.trim();
    const hasPhoto = !!c.photo;
    if (!text && !hasPhoto) continue;
    out[qid] = {};
    if (text) out[qid].text = text;
    if (hasPhoto) out[qid].hasPhoto = true;
  }
  return out;
}

function SectionView({
  sec,
  answers,
  comments,
  onAnswer,
  onComment,
}: {
  sec: Section;
  answers: AnswersState;
  comments: CommentsState;
  onAnswer: (qid: string, a: Answer) => void;
  onComment: (qid: string, c: Comment) => void;
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-2">
        {sec.name}
      </div>
      <div className="space-y-2.5">
        {sec.questions.map((q) => (
          <QuestionView
            key={q.id}
            q={q}
            answer={answers[q.id]}
            comment={comments[q.id]}
            onAnswer={(a) => onAnswer(q.id, a)}
            onComment={(c) => onComment(q.id, c)}
          />
        ))}
      </div>
    </div>
  );
}

function QuestionView({
  q,
  answer,
  comment,
  onAnswer,
  onComment,
}: {
  q: Question;
  answer: Answer | undefined;
  comment: Comment | undefined;
  onAnswer: (a: Answer) => void;
  onComment: (c: Comment) => void;
}) {
  return (
    <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
      <div className={`h-1 ${SEVERITY_BAR[q.severity]}`} />
      <div className="p-3">
        <div className="text-sm font-semibold text-slate-900">{q.title}</div>
        {q.description && (
          <p className="text-xs text-slate-500 mt-0.5">{q.description}</p>
        )}

        <div className="mt-2">
          <AnswerInput cfg={q.answer} answer={answer} onChange={onAnswer} />
        </div>

        {(q.comments.text || q.comments.photo) && (
          <details className="mt-2">
            <summary className="text-[11px] text-slate-500 cursor-pointer select-none">
              Add comment
            </summary>
            <div className="mt-1.5 space-y-1.5">
              {q.comments.text && (
                <textarea
                  rows={2}
                  value={comment?.text ?? ''}
                  onChange={(e) => onComment({ text: e.target.value })}
                  placeholder="Note…"
                  className="w-full px-2 py-1.5 text-xs rounded-md border border-slate-200"
                />
              )}
              {q.comments.photo && (
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => onComment({ photo: e.target.files?.[0] ?? null })}
                  className="text-xs"
                />
              )}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

function AnswerInput({
  cfg,
  answer,
  onChange,
}: {
  cfg: AnswerConfig;
  answer: Answer | undefined;
  onChange: (a: Answer) => void;
}) {
  if (cfg.type === 'yes_no') {
    const a = (answer ?? { type: 'yes_no', value: null }) as Extract<Answer, { type: 'yes_no' }>;
    return <YesNoButtons options={['yes', 'no']} value={a.value} onChange={(v) => onChange({ type: 'yes_no', value: v as 'yes' | 'no' })} correct={cfg.correct} />;
  }
  if (cfg.type === 'yes_no_na') {
    const a = (answer ?? { type: 'yes_no_na', value: null }) as Extract<Answer, { type: 'yes_no_na' }>;
    return (
      <YesNoButtons
        options={['yes', 'no', 'na']}
        value={a.value}
        onChange={(v) => onChange({ type: 'yes_no_na', value: v as 'yes' | 'no' | 'na' })}
        correct={cfg.correct}
      />
    );
  }
  if (cfg.type === 'free_text') {
    const a = (answer ?? { type: 'free_text', value: '' }) as Extract<Answer, { type: 'free_text' }>;
    return (
      <textarea
        rows={3}
        value={a.value}
        onChange={(e) => onChange({ type: 'free_text', value: e.target.value })}
        className="w-full px-2 py-1.5 text-sm rounded-md border border-slate-200"
        placeholder="Type your answer…"
      />
    );
  }
  if (cfg.type === 'measurement') {
    const a = (answer ?? {
      type: 'measurement' as const,
      value: '' as const,
      unit: cfg.defaultUnit ?? cfg.units[0] ?? '',
    }) as Extract<Answer, { type: 'measurement' }>;
    return (
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={a.value}
          onChange={(e) =>
            onChange({
              type: 'measurement',
              value: e.target.value === '' ? '' : Number(e.target.value),
              unit: a.unit,
            })
          }
          className="flex-1 px-2 py-1.5 text-sm rounded-md border border-slate-200"
          placeholder="0"
        />
        <select
          value={a.unit}
          onChange={(e) => onChange({ type: 'measurement', value: a.value, unit: e.target.value })}
          className="px-2 py-1.5 text-sm rounded-md border border-slate-200 bg-white"
        >
          {cfg.units.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </div>
    );
  }
  // photo_set
  const a = (answer ?? {
    type: 'photo_set' as const,
    photos: Object.fromEntries(cfg.slots.map((s) => [s.id, null])),
  }) as Extract<Answer, { type: 'photo_set' }>;
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {cfg.slots.map((s) => {
        const file = a.photos[s.id];
        return (
          <label
            key={s.id}
            className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-2 py-2 text-[11px] text-slate-600 flex flex-col items-center gap-1 cursor-pointer"
          >
            <span>{file ? '✓' : '+'} {s.label}</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) =>
                onChange({
                  type: 'photo_set',
                  photos: { ...a.photos, [s.id]: e.target.files?.[0] ?? null },
                })
              }
            />
          </label>
        );
      })}
    </div>
  );
}

function YesNoButtons({
  options,
  value,
  onChange,
  correct,
}: {
  options: string[];
  value: string | null;
  onChange: (v: string) => void;
  correct: string;
}) {
  return (
    <div className="flex gap-1.5">
      {options.map((o) => {
        const selected = value === o;
        const isCorrect = o === correct;
        return (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            className={`flex-1 py-2 rounded-md text-xs font-semibold uppercase tracking-wide border ${
              selected
                ? isCorrect
                  ? 'bg-emerald-100 border-emerald-300 text-emerald-700'
                  : 'bg-rose-100 border-rose-300 text-rose-700'
                : 'bg-white border-slate-200 text-slate-600'
            }`}
          >
            {o.replace('_', ' ')}
          </button>
        );
      })}
    </div>
  );
}

function EmptyMobile({ message }: { message: string }) {
  return (
    <div className="flex-1 flex items-center justify-center p-6 text-center text-sm text-slate-500">
      {message}
    </div>
  );
}
