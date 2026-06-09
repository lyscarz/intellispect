'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addAssignmentAction, removeAssignmentAction } from '../actions';
import type { Assignment, AssignmentKind } from '@/lib/inspections/types';
import type { Machine, Site } from '@/lib/types';

interface Props {
  templateId: string;
  assignments: Assignment[];
  sites: Site[];
  machines: Machine[];
  assetTypes: string[];
}

const KIND_LABEL: Record<AssignmentKind, string> = {
  all: 'All machines',
  site: 'Site',
  type: 'Type',
  machine: 'Machine',
};

export function AssignmentPanel({ templateId, assignments, sites, machines, assetTypes }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [addingKind, setAddingKind] = useState<AssignmentKind | null>(null);

  const siteName = useMemo(() => Object.fromEntries(sites.map((s) => [s.id, s.name])), [sites]);
  const machineName = useMemo(
    () => Object.fromEntries(machines.map((m) => [m.id, m.name])),
    [machines]
  );

  function add(input: { targetKind: AssignmentKind; targetId?: string; targetValue?: string }) {
    setError(null);
    startTransition(async () => {
      try {
        await addAssignmentAction({ templateId, ...input });
        router.refresh();
        setAddingKind(null);
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  function remove(id: string) {
    setError(null);
    startTransition(async () => {
      try {
        await removeAssignmentAction(templateId, id);
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  function chipLabel(a: Assignment): string {
    switch (a.targetKind) {
      case 'all':
        return 'All machines';
      case 'site':
        return `Site: ${a.targetId ? siteName[a.targetId] ?? '(deleted site)' : '?'}`;
      case 'type':
        return `Type: ${a.targetValue ?? '?'}`;
      case 'machine':
        return `Machine: ${a.targetId ? machineName[a.targetId] ?? '(deleted machine)' : '?'}`;
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Assigned to</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Choose which machines this inspection applies to. A machine matches if any rule applies.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {assignments.length === 0 && (
          <span className="text-xs text-slate-400">No assignments yet — nothing will trigger this inspection.</span>
        )}
        {assignments.map((a) => (
          <span
            key={a.id}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-900"
          >
            <span className="text-[10px] uppercase tracking-wide text-amber-700 font-semibold">
              {KIND_LABEL[a.targetKind]}
            </span>
            <span className="font-medium">{chipLabel(a)}</span>
            <button
              type="button"
              onClick={() => remove(a.id)}
              disabled={pending}
              className="ml-0.5 text-amber-700 hover:text-rose-600"
              aria-label="Remove assignment"
            >
              ×
            </button>
          </span>
        ))}
      </div>

      {addingKind === null ? (
        <button
          type="button"
          onClick={() => setAddingKind('all')}
          className="text-xs font-medium text-brand-700 hover:text-brand-800 inline-flex items-center gap-1"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add assignment
        </button>
      ) : (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center gap-1 mb-3 text-xs">
            {(['all', 'site', 'type', 'machine'] as AssignmentKind[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setAddingKind(k)}
                className={`px-2 py-1 rounded ${
                  addingKind === k
                    ? 'bg-white text-slate-900 border border-slate-300 font-semibold'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {KIND_LABEL[k]}
              </button>
            ))}
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => setAddingKind(null)}
              className="text-slate-400 hover:text-slate-600"
            >
              Cancel
            </button>
          </div>

          {addingKind === 'all' && (
            <button
              type="button"
              onClick={() => add({ targetKind: 'all' })}
              disabled={pending}
              className="px-3 py-1.5 rounded-md bg-brand-600 text-white text-xs font-medium hover:bg-brand-700 disabled:opacity-50"
            >
              Assign to all machines
            </button>
          )}

          {addingKind === 'site' && (
            <SelectAndAdd
              placeholder={sites.length ? 'Select a site…' : 'No sites in this account'}
              options={sites.map((s) => ({ value: s.id, label: s.name }))}
              disabled={pending || !sites.length}
              onAdd={(value) => add({ targetKind: 'site', targetId: value })}
            />
          )}

          {addingKind === 'type' && (
            <SelectAndAdd
              placeholder={assetTypes.length ? 'Select a machine type…' : 'No types detected'}
              options={assetTypes.map((t) => ({ value: t, label: t }))}
              disabled={pending || !assetTypes.length}
              onAdd={(value) => add({ targetKind: 'type', targetValue: value })}
            />
          )}

          {addingKind === 'machine' && (
            <SelectAndAdd
              placeholder={machines.length ? 'Select a machine…' : 'No machines in this account'}
              options={machines.map((m) => ({
                value: m.id,
                label: m.brand || m.model
                  ? `${m.name} — ${[m.brand, m.model].filter(Boolean).join(' ')}`
                  : m.name,
              }))}
              disabled={pending || !machines.length}
              onAdd={(value) => add({ targetKind: 'machine', targetId: value })}
            />
          )}
        </div>
      )}

      {error && (
        <div className="mt-2 rounded-md bg-rose-50 border border-rose-200 px-3 py-1.5 text-xs text-rose-700">
          {error}
        </div>
      )}
    </div>
  );
}

function SelectAndAdd({
  placeholder,
  options,
  disabled,
  onAdd,
}: {
  placeholder: string;
  options: { value: string; label: string }[];
  disabled: boolean;
  onAdd: (value: string) => void;
}) {
  const [value, setValue] = useState('');
  return (
    <div className="flex items-center gap-2">
      <select
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="flex-1 px-2 py-1.5 rounded-md border border-slate-300 bg-white text-xs"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => value && onAdd(value)}
        disabled={disabled || !value}
        className="px-3 py-1.5 rounded-md bg-brand-600 text-white text-xs font-medium hover:bg-brand-700 disabled:opacity-50"
      >
        Add
      </button>
    </div>
  );
}
