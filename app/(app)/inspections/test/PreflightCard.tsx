'use client';

import type { PreflightRecommendation, PreflightVerdict } from '@/lib/inspections/types';

const REC_STYLES: Record<PreflightRecommendation, { chip: string; label: string }> = {
  proceed: { chip: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Proceed' },
  heightened: { chip: 'bg-amber-100 text-amber-800 border-amber-200', label: 'Heightened' },
  skip: { chip: 'bg-slate-200 text-slate-700 border-slate-300', label: 'Skip recommended' },
};

export function PreflightCard({
  loading,
  error,
  verdict,
  onRun,
  onClose,
}: {
  loading: boolean;
  error: string | null;
  verdict: PreflightVerdict | null;
  onRun: () => void;
  onClose: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400 font-semibold">
            Pre-inspection analysis
          </div>
          <h2 className="font-semibold text-slate-900 mt-0.5">AI is analysing the machine…</h2>
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

      <div className="p-5">
        {loading && !verdict && (
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <svg className="w-4 h-4 animate-spin text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Looking at telematics, recent events, and prior runs…
          </div>
        )}

        {error && (
          <div className="rounded-md bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}

        {verdict && (
          <div className="space-y-3">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-semibold uppercase tracking-wide ${REC_STYLES[verdict.recommendation].chip}`}
            >
              {REC_STYLES[verdict.recommendation].label}
            </span>
            <p className="text-sm text-slate-700 leading-relaxed">{verdict.reasoning}</p>
            {verdict.focusItems && verdict.focusItems.length > 0 && (
              <ul className="text-sm text-slate-700 list-disc list-inside space-y-0.5">
                {verdict.focusItems.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-medium hover:bg-slate-50"
        >
          Skip / close
        </button>
        <button
          type="button"
          onClick={onRun}
          disabled={loading || !verdict}
          className="px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700 disabled:opacity-50"
        >
          Run inspection
        </button>
      </div>
    </div>
  );
}
