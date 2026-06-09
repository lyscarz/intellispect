'use client';

import { useEffect, useRef, useState } from 'react';
import { streamSSE } from '@/lib/inspections/sse-client';
import { ChatBubble } from '@/components/ChatBubble';
import type {
  InspectionTemplate,
  MachineContext,
  PreflightInputs,
} from '@/lib/inspections/types';
import { MachineChip } from './MachineChip';

interface UIMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function MobileIntentRunner({
  template,
  machine = null,
  runId = null,
  aiContext = null,
}: {
  template: InspectionTemplate;
  machine?: MachineContext | null;
  /** Server-side intent-run id from /api/inspections/runs/intent-start. When
   *  provided, the AI may call complete_inspection and the run is persisted. */
  runId?: string | null;
  /** PreflightInputs the inspecting AI received on the first turn. Surfaced
   *  via a collapsible debug expander for admins. Pass null/undefined to hide. */
  aiContext?: PreflightInputs | null;
}) {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState<{ summary?: string } | null>(null);
  const [contextOpen, setContextOpen] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  // Kick off the conversation automatically.
  useEffect(() => {
    send('', /*kickoff*/ true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, streaming]);

  async function send(text: string, kickoff = false) {
    if (streaming) return;
    if (!kickoff && !text.trim()) return;
    setError(null);
    setInput('');

    const userMsg: UIMessage = { role: 'user', content: text };
    const placeholder: UIMessage = { role: 'assistant', content: '' };

    const nextMessages: UIMessage[] = kickoff
      ? [placeholder]
      : [...messages, userMsg, placeholder];
    setMessages(nextMessages);
    setStreaming(true);

    // Build the API payload — strip the trailing empty assistant placeholder.
    const payloadMessages = kickoff
      ? []
      : nextMessages.slice(0, -1).map(({ role, content }) => ({ role, content }));

    let accum = '';
    try {
      await streamSSE(
        '/api/inspections/run-intent',
        { templateId: template.id, messages: payloadMessages, machine, runId },
        (event, data) => {
          if (event === 'prose') {
            const d = (data as { delta?: string }).delta ?? '';
            accum += d;
            setMessages((m) => {
              const next = [...m];
              next[next.length - 1] = { ...next[next.length - 1], content: accum };
              return next;
            });
          } else if (event === 'done') {
            const d = data as { completed?: boolean; summary?: string };
            if (d.completed) setCompleted({ summary: d.summary });
          } else if (event === 'error') {
            setError((data as { message?: string }).message ?? 'Unknown error');
          }
        }
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-shrink-0 px-4 py-2 border-b border-slate-200 bg-white">
        <div className="text-xs uppercase tracking-wide text-slate-400 font-semibold">
          Inspection
        </div>
        <div className="text-sm font-bold text-slate-900">{template.name}</div>
      </div>
      <MachineChip machine={machine} />
      {aiContext && (
        <div className="mx-3 mt-2 rounded-lg bg-slate-100 border border-slate-200 text-[11px] text-slate-700">
          <button
            type="button"
            onClick={() => setContextOpen((o) => !o)}
            className="w-full px-2.5 py-1.5 flex items-center gap-1.5 text-left"
          >
            <svg
              className={`w-3 h-3 transition-transform ${contextOpen ? 'rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <span className="font-semibold uppercase tracking-wide text-[10px] text-slate-500">
              AI context
            </span>
            <span className="text-slate-400">
              · {aiContext.activity ?? 'unknown'} · {aiContext.criticality ?? 'NONE'}
              {aiContext.lastRun ? ' · prior run' : ' · first run'}
            </span>
          </button>
          {contextOpen && (
            <pre className="px-2.5 pb-2 text-[10px] leading-snug overflow-x-auto whitespace-pre-wrap">
{JSON.stringify(aiContext, null, 2)}
            </pre>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
        {messages.map((m, i) => (
          <ChatBubble key={i} role={m.role} content={m.content} />
        ))}
        {streaming && messages[messages.length - 1]?.content === '' && (
          <div className="text-[11px] text-slate-400 italic px-1">Thinking…</div>
        )}
        {completed && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2.5 text-xs text-emerald-900">
            <div className="font-semibold uppercase tracking-wide text-[10px] text-emerald-700 mb-1">
              Inspection complete
            </div>
            {completed.summary}
          </div>
        )}
        <div ref={endRef} />
      </div>

      {error && (
        <div className="mx-3 mb-2 rounded-md bg-rose-50 border border-rose-200 px-3 py-1.5 text-xs text-rose-700">
          {error}
        </div>
      )}

      <div className="flex-shrink-0 p-2 border-t border-slate-200 bg-white">
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Reply…"
            disabled={streaming || !!completed}
            className="flex-1 px-3 py-2 rounded-full border border-slate-300 text-sm outline-none focus:border-brand-500"
          />
          <button
            type="button"
            onClick={() => send(input)}
            disabled={streaming || !input.trim() || !!completed}
            className="p-2 rounded-full bg-brand-600 text-white disabled:opacity-40"
            aria-label="Send"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

