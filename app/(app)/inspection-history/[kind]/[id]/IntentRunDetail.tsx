'use client';

import { useState } from 'react';
import { ChatBubble } from '@/components/ChatBubble';
import type { IntentRun } from '@/lib/inspections/types';

export function IntentRunDetail({ run }: { run: IntentRun }) {
  const [convoOpen, setConvoOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);

  const findings = (run.findings ?? null) as Record<string, unknown> | null;
  const recommendations: string[] = Array.isArray(findings?.recommendations)
    ? ((findings!.recommendations as unknown[]).filter((x) => typeof x === 'string') as string[])
    : [];
  const skipped = findings?.skipped === true;
  // Everything in findings *except* recommendations/skipped is "real" structured
  // data the AI captured from the conversation — show it on the page.
  const findingsEntries = findings
    ? Object.entries(findings).filter(
        ([k, v]) =>
          k !== 'recommendations' &&
          k !== 'skipped' &&
          v !== null &&
          v !== undefined &&
          !(Array.isArray(v) && v.length === 0) &&
          !(typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length === 0)
      )
    : [];
  const isFail = run.outcome === 'fail';
  const isAttention = run.outcome === 'attention';

  return (
    <div className="space-y-3">
      {/* Top card — outcome + summary + recommendations */}
      <div
        className={`rounded-xl border p-4 ${
          isFail
            ? 'bg-rose-50 border-rose-200'
            : isAttention
              ? 'bg-amber-50 border-amber-200'
              : 'bg-white border-slate-200'
        }`}
      >
        <div className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 mb-1">
          {skipped ? 'Inspection skipped' : 'AI summary'}
        </div>
        <p className="text-sm text-slate-800 leading-relaxed">
          {run.summary ??
            (run.status === 'in_progress'
              ? 'Inspection in progress — no summary yet.'
              : 'No summary recorded.')}
        </p>

        {recommendations.length > 0 && (
          <div className="mt-3">
            <div
              className={`text-[10px] uppercase tracking-wide font-semibold mb-1 ${
                isFail ? 'text-rose-700' : 'text-amber-700'
              }`}
            >
              {isFail ? 'Action required' : 'Recommendations'}
            </div>
            <ul className="space-y-1">
              {recommendations.map((rec, i) => (
                <li
                  key={i}
                  className={`text-sm flex items-start gap-2 ${
                    isFail ? 'text-rose-900' : 'text-amber-900'
                  }`}
                >
                  <svg
                    className="w-3.5 h-3.5 flex-shrink-0 mt-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Findings card — structured observations captured from the operator. */}
      {findingsEntries.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold mb-2">
            Findings
          </div>
          <dl className="space-y-2">
            {findingsEntries.map(([key, value]) => (
              <div key={key} className="flex flex-col sm:flex-row sm:gap-3">
                <dt className="text-xs font-semibold text-slate-600 sm:w-44 sm:flex-shrink-0">
                  {humanise(key)}
                </dt>
                <dd className="text-sm text-slate-800 flex-1">{renderValue(value)}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-[11px] text-slate-400">
            The next inspection on this machine will see these findings and ask if they&apos;ve been resolved.
          </p>
        </div>
      )}

      {/* Conversation expander */}
      <Expander
        open={convoOpen}
        onToggle={() => setConvoOpen((o) => !o)}
        label={`Conversation (${run.transcript.length} messages)`}
      >
        <div className="space-y-2.5">
          {run.transcript.length === 0 && (
            <div className="text-xs text-slate-400">No transcript captured.</div>
          )}
          {run.transcript.map((m, i) => (
            <ChatBubble key={i} role={m.role} content={m.content} />
          ))}
        </div>
      </Expander>

      {/* Audit expander */}
      <Expander
        open={auditOpen}
        onToggle={() => setAuditOpen((o) => !o)}
        label="Audit (YAML + AI context at start)"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-1">
              YAML snapshot
            </div>
            <pre className="text-[11px] font-mono leading-snug bg-slate-900 text-slate-100 rounded-md p-2 overflow-x-auto whitespace-pre-wrap">
{run.yamlSnapshot || '(none)'}
            </pre>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-1">
              AI context (preflight)
            </div>
            <pre className="text-[11px] font-mono leading-snug bg-slate-100 text-slate-700 rounded-md p-2 overflow-x-auto whitespace-pre-wrap">
{JSON.stringify(run.preflight ?? {}, null, 2)}
            </pre>
          </div>
        </div>
      </Expander>
    </div>
  );
}

function humanise(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function renderValue(value: unknown): React.ReactNode {
  if (value === null || value === undefined) return <span className="text-slate-400">—</span>;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-slate-400">—</span>;
    return (
      <ul className="space-y-0.5">
        {value.map((item, i) => (
          <li key={i} className="flex items-start gap-1.5">
            <span className="text-slate-300 mt-1.5">•</span>
            <span>{typeof item === 'object' ? <code className="text-xs">{JSON.stringify(item)}</code> : String(item)}</span>
          </li>
        ))}
      </ul>
    );
  }
  // Generic object — fallback to JSON.
  return (
    <pre className="text-[11px] font-mono whitespace-pre-wrap text-slate-700 bg-slate-50 rounded px-2 py-1">
{JSON.stringify(value, null, 2)}
    </pre>
  );
}

function Expander({
  open,
  onToggle,
  label,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-2.5 flex items-center gap-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        <svg
          className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-90' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        {label}
      </button>
      {open && <div className="px-4 pb-4 pt-1">{children}</div>}
    </div>
  );
}
