'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { RunFlowModal } from './RunFlowModal';
import type { InspectionTemplate, MachineContext } from '@/lib/inspections/types';

interface ApiResponse {
  templates: InspectionTemplate[];
  machineContext: MachineContext;
}

export function MachineInspectionsDrawer({
  machineId,
  onClose,
}: {
  machineId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState<InspectionTemplate | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    fetch(`/api/inspections/for-machine?machineId=${encodeURIComponent(machineId)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`Failed (${r.status})`);
        return (await r.json()) as ApiResponse;
      })
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [machineId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !running) onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose, running]);

  const machine = data?.machineContext ?? null;
  const subtitle = machine
    ? [machine.brand, machine.model, machine.assetType].filter(Boolean).join(' · ')
    : '';

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} aria-hidden="true" />
      <aside className="fixed inset-y-0 right-0 z-40 w-full max-w-md bg-white shadow-2xl flex flex-col">
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-200">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wide text-slate-400 font-semibold">
              Machine
            </div>
            <div className="font-semibold text-slate-900 truncate">{machine?.name ?? '…'}</div>
            {subtitle && <div className="text-xs text-slate-500 mt-0.5 truncate">{subtitle}</div>}
            {machine?.siteName && (
              <div className="text-[11px] text-slate-400 mt-0.5 truncate">{machine.siteName}</div>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {error && (
            <div className="rounded-md bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}

          {!data && !error && <div className="text-sm text-slate-400">Loading…</div>}

          {data && data.templates.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
              No inspections apply to this machine yet.
              <div className="mt-2">
                <Link href="/inspections" className="text-brand-700 hover:text-brand-800 font-medium">
                  Go assign one →
                </Link>
              </div>
            </div>
          )}

          {data && data.templates.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wide text-slate-400 font-semibold mb-2">
                Assigned inspections ({data.templates.length})
              </div>
              {data.templates.map((t) => (
                <div
                  key={t.id}
                  className="rounded-xl border border-slate-200 p-3 flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${
                          t.kind === 'intent'
                            ? 'bg-violet-100 text-violet-700'
                            : 'bg-sky-100 text-sky-700'
                        }`}
                      >
                        {t.kind === 'intent' ? 'AI' : 'Form'}
                      </span>
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${
                          t.status === 'active'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {t.status}
                      </span>
                    </div>
                    <div className="mt-1 font-mono text-xs text-amber-600">/{t.handle}</div>
                    <div className="font-semibold text-slate-900 truncate">{t.name}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRunning(t)}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
                  >
                    Run
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      {running && machine && (
        <RunFlowModal template={running} machine={machine} onClose={() => setRunning(null)} />
      )}
    </>
  );
}
