'use client';

import { useState, useTransition } from 'react';
import { nanoid } from 'nanoid';
import { saveFormSchemaAction } from '../actions';
import { AnswerConfigEditor } from './AnswerConfigEditor';
import type {
  AnswerConfig,
  FormSchema,
  InspectionTemplate,
  Question,
  Section,
  Severity,
} from '@/lib/inspections/types';

const DEFAULT_ANSWER: AnswerConfig = { type: 'yes_no', correct: 'yes' };
const SEVERITIES: Severity[] = ['low', 'medium', 'high', 'critical'];
const SEVERITY_STYLES: Record<Severity, string> = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-rose-100 text-rose-700',
};

function blankQuestion(): Question {
  return {
    id: nanoid(8),
    title: 'New question',
    severity: 'low',
    answer: DEFAULT_ANSWER,
    comments: { photo: false, text: false },
  };
}

function blankSection(): Section {
  return { id: nanoid(8), name: 'New section', questions: [] };
}

export function FormEditor({ template }: { template: InspectionTemplate }) {
  const initial: FormSchema = template.form_schema ?? { sections: [] };
  const [schema, setSchema] = useState<FormSchema>(initial);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function updateSection(idx: number, patch: Partial<Section>) {
    setSchema((s) => ({
      ...s,
      sections: s.sections.map((sec, i) => (i === idx ? { ...sec, ...patch } : sec)),
    }));
  }

  function removeSection(idx: number) {
    setSchema((s) => ({ ...s, sections: s.sections.filter((_, i) => i !== idx) }));
  }

  function addQuestion(secIdx: number) {
    setSchema((s) => ({
      ...s,
      sections: s.sections.map((sec, i) =>
        i === secIdx ? { ...sec, questions: [...sec.questions, blankQuestion()] } : sec
      ),
    }));
  }

  function updateQuestion(secIdx: number, qIdx: number, patch: Partial<Question>) {
    setSchema((s) => ({
      ...s,
      sections: s.sections.map((sec, i) =>
        i === secIdx
          ? { ...sec, questions: sec.questions.map((q, j) => (j === qIdx ? { ...q, ...patch } : q)) }
          : sec
      ),
    }));
  }

  function removeQuestion(secIdx: number, qIdx: number) {
    setSchema((s) => ({
      ...s,
      sections: s.sections.map((sec, i) =>
        i === secIdx ? { ...sec, questions: sec.questions.filter((_, j) => j !== qIdx) } : sec
      ),
    }));
  }

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await saveFormSchemaAction(template.id, schema);
        setSavedAt(new Date());
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Sections & questions</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {schema.sections.length} section{schema.sections.length === 1 ? '' : 's'} ·{' '}
            {schema.sections.reduce((n, s) => n + s.questions.length, 0)} question
            {schema.sections.reduce((n, s) => n + s.questions.length, 0) === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {savedAt && (
            <span className="text-xs text-slate-400">Saved {savedAt.toLocaleTimeString()}</span>
          )}
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-700 disabled:opacity-50"
          >
            {pending ? 'Saving…' : 'Save form'}
          </button>
        </div>
      </div>

      {error && (
        <div className="m-4 rounded-md bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="p-4 space-y-4">
        {schema.sections.length === 0 && (
          <p className="text-sm text-slate-500">No sections yet. Add one to get started.</p>
        )}

        {schema.sections.map((sec, sIdx) => (
          <div key={sec.id} className="rounded-lg border border-slate-200">
            <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
              <input
                type="text"
                value={sec.name}
                onChange={(e) => updateSection(sIdx, { name: e.target.value })}
                className="flex-1 px-2 py-1 rounded border border-transparent hover:border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none text-sm font-semibold bg-white"
              />
              <button
                type="button"
                onClick={() => removeSection(sIdx)}
                className="text-xs text-rose-500 hover:text-rose-700"
              >
                Remove section
              </button>
            </div>

            <div className="p-3 space-y-3">
              {sec.questions.length === 0 && (
                <p className="text-xs text-slate-400">No questions in this section.</p>
              )}
              {sec.questions.map((q, qIdx) => (
                <QuestionCard
                  key={q.id}
                  q={q}
                  onChange={(patch) => updateQuestion(sIdx, qIdx, patch)}
                  onRemove={() => removeQuestion(sIdx, qIdx)}
                />
              ))}
              <button
                type="button"
                onClick={() => addQuestion(sIdx)}
                className="text-xs font-medium text-brand-700 hover:text-brand-800 inline-flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add question
              </button>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={() => setSchema((s) => ({ ...s, sections: [...s.sections, blankSection()] }))}
          className="w-full px-3 py-2 rounded-lg border-2 border-dashed border-slate-300 text-sm text-slate-600 hover:border-brand-300 hover:text-brand-700"
        >
          + Add section
        </button>
      </div>
    </div>
  );
}

function QuestionCard({
  q,
  onChange,
  onRemove,
}: {
  q: Question;
  onChange: (patch: Partial<Question>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-start gap-2">
        <input
          type="text"
          value={q.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Question title"
          className="flex-1 px-2 py-1 rounded border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none text-sm font-medium"
        />
        <select
          value={q.severity}
          onChange={(e) => onChange({ severity: e.target.value as Severity })}
          className={`px-2 py-1 rounded text-[11px] font-semibold uppercase tracking-wide ${SEVERITY_STYLES[q.severity]} border border-transparent`}
        >
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-rose-500 hover:text-rose-700 self-center"
        >
          Remove
        </button>
      </div>

      <textarea
        value={q.description ?? ''}
        onChange={(e) => onChange({ description: e.target.value || undefined })}
        placeholder="Description (optional)"
        rows={2}
        className="mt-2 w-full px-2 py-1 rounded border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none text-xs"
      />

      <AnswerConfigEditor value={q.answer} onChange={(answer) => onChange({ answer })} />

      <div className="mt-2 flex items-center gap-4 text-xs">
        <span className="text-slate-500">Allow comments:</span>
        <label className="inline-flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={q.comments.text}
            onChange={(e) => onChange({ comments: { ...q.comments, text: e.target.checked } })}
          />
          Text
        </label>
        <label className="inline-flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={q.comments.photo}
            onChange={(e) => onChange({ comments: { ...q.comments, photo: e.target.checked } })}
          />
          Photo
        </label>
      </div>
    </div>
  );
}
