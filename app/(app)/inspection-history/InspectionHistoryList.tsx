'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type {
  EscalationKind,
  Outcome,
  UnifiedRunRow,
} from '@/lib/inspections/types';
import { createEscalationAction } from './actions';

const KIND_OPTIONS: { value: 'all' | 'form' | 'intent'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'form', label: 'Form' },
  { value: 'intent', label: 'AI' },
];

const OUTCOME_OPTIONS: { value: 'all' | Outcome | 'pending'; label: string }[] = [
  { value: 'all', label: 'Any outcome' },
  { value: 'pass', label: 'Pass' },
  { value: 'attention', label: 'Attention' },
  { value: 'fail', label: 'Fail' },
  { value: 'pending', label: 'Pending' },
];

const OUTCOME_CHIP: Record<string, string> = {
  pass: 'bg-emerald-100 text-emerald-700',
  attention: 'bg-amber-100 text-amber-700',
  fail: 'bg-rose-100 text-rose-700',
  pending: 'bg-slate-100 text-slate-500',
};

const STATUS_CHIP: Record<string, string> = {
  in_progress: 'bg-sky-100 text-sky-700',
  complete: 'bg-slate-100 text-slate-600',
  partial: 'bg-amber-50 text-amber-700',
  skipped: 'bg-slate-100 text-slate-500',
};

export function InspectionHistoryList({ runs }: { runs: UnifiedRunRow[] }) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<'all' | 'form' | 'intent'>('all');
  const [outcome, setOutcome] = useState<'all' | Outcome | 'pending'>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return runs.filter((r) => {
      if (kind !== 'all' && r.kind !== kind) return false;
      if (outcome !== 'all') {
        if (outcome === 'pending') {
          if (r.outcome !== null) return false;
        } else if (r.outcome !== outcome) {
          return false;
        }
      }
      if (!q) return true;
      const hay = [r.templateName, r.templateHandle, r.machineName, r.summary]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [runs, query, kind, outcome]);

  return (
    <div className="mt-6 space-y-3">
      <div className="rounded-xl border border-slate-200 bg-white p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[14rem]">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by template, machine, summary…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none text-sm"
          />
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <SegmentedControl
          value={kind}
          onChange={(v) => setKind(v as 'all' | 'form' | 'intent')}
          options={KIND_OPTIONS}
        />
        <select
          value={outcome}
          onChange={(e) => setOutcome(e.target.value as 'all' | Outcome | 'pending')}
          className="px-2 py-1.5 rounded-lg border border-slate-300 text-sm bg-white"
        >
          {OUTCOME_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          No inspection runs match these filters.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((run) => (
            <RunCard key={`${run.kind}-${run.id}`} run={run} />
          ))}
        </div>
      )}
    </div>
  );
}

function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-lg border border-slate-300 overflow-hidden bg-white">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`px-3 py-1.5 text-xs font-medium ${
              active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function RunCard({ run }: { run: UnifiedRunRow }) {
  const href = `/inspection-history/${run.kind}/${run.id}`;
  const outcomeKey = run.outcome ?? 'pending';
  const escalateInline = run.outcome === 'fail' || run.outcome === 'attention';
  const started = new Date(run.startedAt).toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 flex items-center gap-3">
      <Link href={href} className="flex-1 min-w-0 group">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${
              run.kind === 'intent'
                ? 'bg-violet-100 text-violet-700'
                : 'bg-sky-100 text-sky-700'
            }`}
          >
            {run.kind === 'intent' ? 'AI' : 'Form'}
          </span>
          <span
            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${
              STATUS_CHIP[run.status] ?? STATUS_CHIP.complete
            }`}
          >
            {run.status.replace('_', ' ')}
          </span>
          <span
            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${
              OUTCOME_CHIP[outcomeKey] ?? OUTCOME_CHIP.pending
            }`}
          >
            {outcomeKey}
          </span>
          {run.escalationCount > 0 && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-orange-100 text-orange-700">
              Escalated · {run.escalationCount}
            </span>
          )}
          <span className="font-mono text-[11px] text-amber-600">/{run.templateHandle}</span>
        </div>
        <div className="mt-1 font-semibold text-slate-900 truncate group-hover:text-brand-700">
          {run.templateName}
        </div>
        <div className="mt-0.5 text-xs text-slate-500 truncate">
          {run.machineName ?? '(no machine)'} · {started}
        </div>
        {run.summary && (
          <div className="mt-1 text-xs text-slate-600 line-clamp-2">{run.summary}</div>
        )}
      </Link>
      {escalateInline && <InlineEscalateMenu run={run} />}
    </div>
  );
}

function InlineEscalateMenu({ run }: { run: UnifiedRunRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function escalate(kind: EscalationKind) {
    setError(null);
    startTransition(async () => {
      try {
        await createEscalationAction({
          responseId: run.kind === 'form' ? run.id : undefined,
          intentRunId: run.kind === 'intent' ? run.id : undefined,
          machineId: run.machineId,
          kind,
          notes: `Quick-escalated from history list (${run.outcome ?? 'pending'} outcome).`,
        });
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-1.5">
        <EscButton onClick={() => escalate('manager')} disabled={pending} label="Manager" />
        <EscButton onClick={() => escalate('service')} disabled={pending} label="Service" />
        <EscButton onClick={() => escalate('event')} disabled={pending} label="Event" />
      </div>
      {error && (
        <span className="text-[11px] text-rose-600 max-w-xs text-right">{error}</span>
      )}
    </div>
  );
}

function EscButton({
  onClick,
  disabled,
  label,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="px-2 py-1 rounded-md bg-rose-50 border border-rose-200 text-[11px] font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50"
    >
      {label}
    </button>
  );
}
