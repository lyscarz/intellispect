'use client';

import { useState, useTransition } from 'react';
import { createTemplateAction } from '../actions';
import type { InspectionKind } from '@/lib/inspections/types';

export function NewInspectionPicker() {
  const [kind, setKind] = useState<InspectionKind | null>(null);
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    if (!kind) return;
    startTransition(async () => {
      try {
        await createTemplateAction(kind, name, handle);
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="grid sm:grid-cols-2 gap-3">
        <KindOption
          selected={kind === 'form'}
          onClick={() => setKind('form')}
          badge="Form"
          badgeClass="bg-sky-100 text-sky-700"
          title="Standard form"
          body="Sectioned questions with typed answers — measurement, yes/no, free text, photo set."
        />
        <KindOption
          selected={kind === 'intent'}
          onClick={() => setKind('intent')}
          badge="AI"
          badgeClass="bg-violet-100 text-violet-700"
          title="Intent-driven (AI)"
          body="Chat with Claude to author a YAML intent. The runtime guides the operator conversationally."
        />
      </div>

      {kind && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
          <Field
            label="Name"
            value={name}
            onChange={setName}
            placeholder="Operator handover"
            autoFocus
          />
          <Field
            label="Handle"
            value={handle}
            onChange={setHandle}
            placeholder="handover"
            prefix="/"
            help="Short slug operators can invoke. Lowercase letters, numbers, dashes."
          />
          {error && (
            <div className="rounded-md bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={submit}
              disabled={pending || !name.trim() || !handle.trim()}
              className="px-3 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
            >
              {pending ? 'Creating…' : 'Create'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function KindOption({
  selected,
  onClick,
  badge,
  badgeClass,
  title,
  body,
}: {
  selected: boolean;
  onClick: () => void;
  badge: string;
  badgeClass: string;
  title: string;
  body: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-xl border p-4 transition ${
        selected
          ? 'border-brand-500 ring-2 ring-brand-200 bg-white'
          : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <span
        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${badgeClass}`}
      >
        {badge}
      </span>
      <div className="mt-2 font-semibold text-slate-900">{title}</div>
      <div className="mt-1 text-xs text-slate-500">{body}</div>
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  prefix,
  help,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  prefix?: string;
  help?: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-700 mb-1">{label}</span>
      <div className="flex rounded-md border border-slate-300 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-200 overflow-hidden">
        {prefix && (
          <span className="px-2 inline-flex items-center text-sm text-slate-400 bg-slate-50 border-r border-slate-200">
            {prefix}
          </span>
        )}
        <input
          autoFocus={autoFocus}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 text-sm outline-none"
        />
      </div>
      {help && <span className="block text-[11px] text-slate-400 mt-1">{help}</span>}
    </label>
  );
}
