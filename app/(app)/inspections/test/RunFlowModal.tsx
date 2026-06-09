'use client';

import { useEffect, useState } from 'react';
import { PhoneFrame } from '@/components/PhoneFrame';
import { MobileFormRunner } from '../[id]/MobileFormRunner';
import { MobileIntentRunner } from '../[id]/MobileIntentRunner';
import { PreflightCard } from './PreflightCard';
import type {
  InspectionTemplate,
  MachineContext,
  PreflightInputs,
  PreflightVerdict,
} from '@/lib/inspections/types';

interface Props {
  template: InspectionTemplate;
  machine: MachineContext;
  onClose: () => void;
}

type Stage = 'preflight' | 'running';

export function RunFlowModal({ template, machine, onClose }: Props) {
  const isIntent = template.kind === 'intent';

  // Intent templates skip the verdict card entirely — the inspection AI now
  // sees the machine context directly and decides what to do inline.
  const [stage, setStage] = useState<Stage>(isIntent ? 'running' : 'preflight');
  const [verdict, setVerdict] = useState<PreflightVerdict | null>(null);
  const [aiContext, setAiContext] = useState<PreflightInputs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [startingRun, setStartingRun] = useState(false);

  // Body scroll lock + Esc-to-close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  // Form path: fetch the verdict so we can render the PreflightCard.
  // Intent path: speculatively POST intent-start so the row exists when the
  // AI decides to complete_inspection and so we can surface the raw inputs in
  // the admin debug panel.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const url = isIntent
      ? '/api/inspections/runs/intent-start'
      : '/api/inspections/preflight';

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateId: template.id, machineId: machine.id }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`Pre-flight failed (${r.status})`);
        return (await r.json()) as
          | { verdict: PreflightVerdict }
          | { runId: string; preflightInputs: PreflightInputs };
      })
      .then((data) => {
        if (cancelled) return;
        if ('runId' in data) {
          setRunId(data.runId);
          setAiContext(data.preflightInputs);
        } else {
          setVerdict(data.verdict);
        }
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [template.id, machine.id, isIntent]);

  async function startFormRun() {
    if (!verdict || startingRun) return;
    setStartingRun(true);
    try {
      setStage('running');
    } finally {
      setStartingRun(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      {stage === 'preflight' && (
        <PreflightCard
          loading={loading || startingRun}
          error={error}
          verdict={verdict}
          onRun={startFormRun}
          onClose={onClose}
        />
      )}

      {stage === 'running' && (
        <div className="relative flex flex-col items-center gap-3">
          <div className="flex items-center gap-2 text-white text-sm">
            <span className="font-semibold">Running</span>
            <span className="text-white/60">·</span>
            <span className="font-mono text-amber-200">/{template.handle}</span>
            {isIntent && loading && (
              <span className="text-white/60 text-xs">· starting…</span>
            )}
          </div>
          <PhoneFrame>
            {template.kind === 'form' ? (
              <MobileFormRunner
                template={template}
                machine={machine}
                briefing={verdict?.briefing ?? null}
                preflight={verdict ?? null}
              />
            ) : runId ? (
              <MobileIntentRunner
                template={template}
                machine={machine}
                runId={runId}
                aiContext={aiContext}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm text-slate-500">
                Preparing inspection…
              </div>
            )}
          </PhoneFrame>
          {error && (
            <div className="text-xs text-rose-200 max-w-md text-center">{error}</div>
          )}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-0 right-0 -mr-12 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
