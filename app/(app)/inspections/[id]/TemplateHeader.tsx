'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteTemplateAction, updateMetaAction } from '../actions';
import { TestInAppButton } from './TestInAppButton';
import type { InspectionStatus, InspectionTemplate } from '@/lib/inspections/types';

export function TemplateHeader({ template }: { template: InspectionTemplate }) {
  const router = useRouter();
  const [name, setName] = useState(template.name);
  const [handle, setHandle] = useState(template.handle);
  const [status, setStatus] = useState<InspectionStatus>(template.status);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const dirty =
    name.trim() !== template.name ||
    handle.trim() !== template.handle ||
    status !== template.status;

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await updateMetaAction(template.id, { name, handle, status });
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  function remove() {
    if (!confirm(`Delete "${template.name}"? This cannot be undone.`)) return;
    startTransition(async () => {
      try {
        await deleteTemplateAction(template.id);
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 flex flex-wrap items-center gap-3">
      <span
        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${
          template.kind === 'intent' ? 'bg-violet-100 text-violet-700' : 'bg-sky-100 text-sky-700'
        }`}
      >
        {template.kind === 'intent' ? 'AI' : 'Form'}
      </span>

      <div className="flex items-center gap-2 flex-1 min-w-[20rem]">
        <label className="flex items-center gap-1 text-xs text-slate-500">
          /
          <input
            type="text"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            className="w-28 px-2 py-1 rounded border border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none font-mono text-sm text-amber-600"
          />
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 px-2 py-1 rounded border border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none text-sm font-semibold"
        />
      </div>

      <select
        value={status}
        onChange={(e) => setStatus(e.target.value as InspectionStatus)}
        className="px-2 py-1 rounded border border-slate-300 text-xs"
      >
        <option value="draft">Draft</option>
        <option value="active">Active</option>
      </select>

      <button
        type="button"
        onClick={save}
        disabled={!dirty || pending}
        className="px-3 py-1.5 rounded-lg bg-amber-400 text-slate-900 text-xs font-semibold hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
        </svg>
        {pending ? 'Saving…' : 'Update'}
      </button>

      <TestInAppButton template={template} />

      <button
        type="button"
        onClick={remove}
        disabled={pending}
        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50"
        aria-label="Delete"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a2 2 0 012-2h2a2 2 0 012 2v3" />
        </svg>
      </button>

      {error && (
        <div className="w-full rounded-md bg-rose-50 border border-rose-200 px-3 py-1.5 text-xs text-rose-700">
          {error}
        </div>
      )}
    </div>
  );
}
