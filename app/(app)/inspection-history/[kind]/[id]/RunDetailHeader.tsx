import type { Outcome } from '@/lib/inspections/types';

const OUTCOME_CHIP: Record<string, string> = {
  pass: 'bg-emerald-100 text-emerald-700',
  attention: 'bg-amber-100 text-amber-700',
  fail: 'bg-rose-100 text-rose-700',
  pending: 'bg-slate-100 text-slate-500',
};

const STATUS_CHIP: Record<string, string> = {
  in_progress: 'bg-sky-100 text-sky-700',
  complete: 'bg-slate-100 text-slate-600',
  completed: 'bg-slate-100 text-slate-600',
  partial: 'bg-amber-50 text-amber-700',
  skipped: 'bg-slate-100 text-slate-500',
};

export function RunDetailHeader({
  kind,
  templateName,
  templateHandle,
  machineName,
  machineBrand,
  machineModel,
  siteName,
  startedAt,
  completedAt,
  status,
  outcome,
}: {
  kind: 'form' | 'intent';
  templateName: string;
  templateHandle: string;
  machineName: string | null;
  machineBrand: string | null;
  machineModel: string | null;
  siteName: string | null;
  startedAt: string;
  completedAt: string | null;
  status: string;
  outcome: Outcome | null;
}) {
  const outcomeKey = outcome ?? 'pending';
  const machineSubtitle = [machineBrand, machineModel].filter(Boolean).join(' · ');

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <span
          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${
            kind === 'intent' ? 'bg-violet-100 text-violet-700' : 'bg-sky-100 text-sky-700'
          }`}
        >
          {kind === 'intent' ? 'AI' : 'Form'}
        </span>
        <span
          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${
            STATUS_CHIP[status] ?? STATUS_CHIP.complete
          }`}
        >
          {status.replace('_', ' ')}
        </span>
        <span
          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${
            OUTCOME_CHIP[outcomeKey] ?? OUTCOME_CHIP.pending
          }`}
        >
          {outcomeKey}
        </span>
        <span className="font-mono text-[11px] text-amber-600">/{templateHandle}</span>
      </div>

      <h1 className="text-lg font-bold text-slate-900">{templateName}</h1>
      <div className="mt-1 text-sm text-slate-600">
        {machineName ?? '(no machine)'}
        {machineSubtitle && <span className="text-slate-400"> · {machineSubtitle}</span>}
      </div>
      <div className="mt-0.5 text-xs text-slate-500">
        {siteName && <>Site: {siteName} · </>}
        Started {formatTs(startedAt)}
        {completedAt && completedAt !== startedAt && <> · Completed {formatTs(completedAt)}</>}
      </div>
    </div>
  );
}

function formatTs(iso: string): string {
  return new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}
