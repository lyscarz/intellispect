'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createEscalationAction, resolveEscalationAction } from '../../actions';
import type { Escalation, EscalationKind } from '@/lib/inspections/types';

const KIND_LABEL: Record<EscalationKind, string> = {
  manager: 'Contact manager',
  service: 'Contact service',
  event: 'Create event',
};

const KIND_DESCRIPTION: Record<EscalationKind, string> = {
  manager: 'Flag this run for your fleet manager to review.',
  service: 'Request a service team follow-up on this machine.',
  event: "Record this as an event on the machine's telematics log.",
};

const STATUS_CHIP: Record<string, string> = {
  open: 'bg-rose-100 text-rose-700',
  sent: 'bg-amber-100 text-amber-700',
  resolved: 'bg-emerald-100 text-emerald-700',
  dismissed: 'bg-slate-100 text-slate-500',
};

export function EscalationPanel({
  existing,
  target,
}: {
  existing: Escalation[];
  target: { responseId?: string; intentRunId?: string; machineId: string | null };
}) {
  const router = useRouter();
  const [openKind, setOpenKind] = useState<EscalationKind | null>(null);
  const [notes, setNotes] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (!openKind) return;
    setError(null);
    startTransition(async () => {
      try {
        await createEscalationAction({
          responseId: target.responseId,
          intentRunId: target.intentRunId,
          machineId: target.machineId ?? null,
          kind: openKind,
          notes: notes.trim() || undefined,
        });
        setOpenKind(null);
        setNotes('');
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  function resolve(id: string) {
    setError(null);
    startTransition(async () => {
      try {
        await resolveEscalationAction(id);
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Escalation</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Flag this run to your manager, service team, or as a machine event.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {(Object.keys(KIND_LABEL) as EscalationKind[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setOpenKind(k);
              setNotes('');
            }}
            className={`px-3 py-1.5 rounded-md text-xs font-medium border ${
              openKind === k
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
            }`}
          >
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>

      {openKind && (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 mb-3">
          <div className="text-xs text-slate-600 mb-1.5">{KIND_DESCRIPTION[openKind]}</div>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes for whoever picks this up…"
            className="w-full px-2 py-1.5 text-xs rounded-md border border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none"
          />
          <div className="mt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setOpenKind(null);
                setNotes('');
              }}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={pending}
              className="px-3 py-1.5 rounded-md bg-rose-600 text-white text-xs font-medium hover:bg-rose-700 disabled:opacity-50"
            >
              {pending ? 'Logging…' : `Log ${KIND_LABEL[openKind].toLowerCase()}`}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-md bg-rose-50 border border-rose-200 px-3 py-1.5 text-xs text-rose-700 mb-3">
          {error}
        </div>
      )}

      {existing.length === 0 ? (
        <div className="text-xs text-slate-400">No escalations yet.</div>
      ) : (
        <ul className="space-y-2">
          {existing.map((e) => (
            <li
              key={e.id}
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs flex items-start gap-2"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${
                      STATUS_CHIP[e.status] ?? STATUS_CHIP.open
                    }`}
                  >
                    {e.status}
                  </span>
                  <span className="font-medium text-slate-700">{KIND_LABEL[e.kind]}</span>
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-400">
                    {new Date(e.createdAt).toLocaleString([], {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </span>
                </div>
                {e.notes && (
                  <div className="mt-1 text-slate-700 whitespace-pre-wrap">{e.notes}</div>
                )}
              </div>
              {e.status === 'open' && (
                <button
                  type="button"
                  onClick={() => resolve(e.id)}
                  disabled={pending}
                  className="text-[11px] text-emerald-700 hover:text-emerald-800 font-medium"
                >
                  Resolve
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
