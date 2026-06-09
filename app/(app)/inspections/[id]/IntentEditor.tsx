'use client';

import { useEffect, useRef, useState } from 'react';
import { streamSSE } from '@/lib/inspections/sse-client';
import type { ChatMessage, InspectionTemplate } from '@/lib/inspections/types';

interface Props {
  template: InspectionTemplate;
}

const SUGGESTIONS = [
  'Build an operator handover inspection for excavators',
  'Add a must-have for hydraulic leaks under the boom',
  'Add escalation if there is smoke or abnormal heat',
];

export function IntentEditor({ template }: Props) {
  const [history, setHistory] = useState<ChatMessage[]>(template.chat_history ?? []);
  const [yamlBody, setYamlBody] = useState<string>(template.yaml_body ?? '');
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [yamlFlash, setYamlFlash] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history.length, streaming]);

  async function send(text: string) {
    if (!text.trim() || streaming) return;
    setError(null);
    setInput('');

    const userMsg: ChatMessage = {
      role: 'user',
      content: text,
      ts: new Date().toISOString(),
    };
    const placeholder: ChatMessage = {
      role: 'assistant',
      content: '',
      ts: new Date().toISOString(),
    };
    setHistory((h) => [...h, userMsg, placeholder]);
    setStreaming(true);

    let assistantAccum = '';
    try {
      await streamSSE(
        '/api/inspections/chat',
        { templateId: template.id, userMessage: text },
        (event, data) => {
          if (event === 'prose') {
            const d = (data as { delta?: string }).delta ?? '';
            assistantAccum += d;
            setHistory((h) => {
              const next = [...h];
              next[next.length - 1] = { ...next[next.length - 1], content: assistantAccum };
              return next;
            });
          } else if (event === 'yaml') {
            const y = (data as { yaml?: string }).yaml ?? '';
            setYamlBody(y);
            setYamlFlash(true);
            setTimeout(() => setYamlFlash(false), 1200);
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
    <div className="grid lg:grid-cols-[1fr,1fr] gap-3 min-h-[600px]">
      {/* Chat pane */}
      <div className="rounded-xl border border-slate-200 bg-white flex flex-col overflow-hidden min-h-[600px]">
        <div className="px-4 py-3 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">Chat with AI</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {history.length === 0 && (
            <div className="text-sm text-slate-500">
              <p>Tell the AI what kind of inspection you want. Try:</p>
              <ul className="mt-2 space-y-1 list-disc list-inside text-slate-700">
                {SUGGESTIONS.map((s) => (
                  <li key={s}>
                    <button
                      type="button"
                      onClick={() => send(s)}
                      className="text-left text-amber-700 hover:text-amber-800 underline-offset-2 hover:underline"
                    >
                      &quot;{s}&quot;
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {history.map((m, i) => (
            <Bubble key={i} role={m.role} content={m.content} />
          ))}
          {streaming && history[history.length - 1]?.content === '' && (
            <div className="text-xs text-slate-400 italic">Thinking…</div>
          )}
          <div ref={chatEndRef} />
        </div>
        <div className="border-t border-slate-200 p-3">
          {error && (
            <div className="mb-2 rounded-md bg-rose-50 border border-rose-200 px-3 py-1.5 text-xs text-rose-700">
              {error}
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={2}
              placeholder="Describe the inspection or refinement…"
              className="flex-1 px-3 py-2 rounded-lg border border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none text-sm resize-none"
              disabled={streaming}
            />
            <button
              type="button"
              onClick={() => send(input)}
              disabled={streaming || !input.trim()}
              className="p-2 rounded-lg bg-amber-400 text-slate-900 hover:bg-amber-500 disabled:opacity-40"
              aria-label="Send"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* YAML pane */}
      <div
        className={`rounded-xl border bg-slate-900 text-slate-100 flex flex-col overflow-hidden min-h-[600px] transition ${
          yamlFlash ? 'border-amber-400 ring-2 ring-amber-300' : 'border-slate-800'
        }`}
      >
        <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-100">YAML preview</h2>
          {yamlFlash && (
            <span className="text-[11px] text-amber-300 font-medium">Updated</span>
          )}
        </div>
        <pre className="flex-1 overflow-auto p-4 text-xs font-mono whitespace-pre-wrap leading-relaxed">
{yamlBody || '# YAML will appear here once you start chatting.'}
        </pre>
      </div>
    </div>
  );
}

function Bubble({ role, content }: { role: 'user' | 'assistant'; content: string }) {
  const isUser = role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
          isUser ? 'bg-amber-100 text-slate-900' : 'bg-slate-100 text-slate-800'
        }`}
      >
        {content || (isUser ? '' : ' ')}
      </div>
    </div>
  );
}
