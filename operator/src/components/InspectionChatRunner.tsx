import { useEffect, useRef, useState } from 'react';
import { Icon } from 'framework7-react';
import { startIntentRun, streamIntent, type IntentTurn } from '../lib/inspections';
import type { InspectionTemplate, Outcome } from '../lib/inspectionTypes';
import type { FleetMachine } from '../types';

interface UIMessage {
  role: 'user' | 'assistant';
  content: string;
}

export default function InspectionChatRunner({
  template,
  machine,
  onDone,
}: {
  template: InspectionTemplate;
  machine: FleetMachine;
  onDone: (outcome: Outcome) => void;
}) {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState<{ summary?: string; outcome?: Outcome } | null>(null);
  const runIdRef = useRef<string | null>(null);
  const startedRef = useRef(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  // Start the run (server row) then kick off the conversation. Guard against
  // React 18 StrictMode double-invoke with startedRef.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      try {
        const { runId } = await startIntentRun(template, machine);
        runIdRef.current = runId;
        await send('', true);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
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
    const nextMessages: UIMessage[] = kickoff ? [placeholder] : [...messages, userMsg, placeholder];
    setMessages(nextMessages);
    setStreaming(true);

    const payload: IntentTurn[] = kickoff
      ? []
      : nextMessages.slice(0, -1).map(({ role, content }) => ({ role, content }));

    let accum = '';
    try {
      await streamIntent(template, machine, payload, runIdRef.current, (event, data) => {
        if (event === 'prose') {
          accum += (data as { delta?: string }).delta ?? '';
          setMessages((m) => {
            const next = [...m];
            next[next.length - 1] = { ...next[next.length - 1], content: accum };
            return next;
          });
        } else if (event === 'done') {
          const d = data as { completed?: boolean; summary?: string; outcome?: Outcome };
          if (d.completed) setCompleted({ summary: d.summary, outcome: d.outcome });
        } else if (event === 'error') {
          setError((data as { message?: string }).message ?? 'Unknown error');
        }
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="op-chat">
      <div className="op-chat-messages">
        {messages.map((m, i) => (
          <div key={i} className={`op-chat-row ${m.role === 'user' ? 'me' : 'ai'}`}>
            <div className="op-chat-bubble">{m.content || ' '}</div>
          </div>
        ))}
        {streaming && messages[messages.length - 1]?.content === '' && (
          <div className="op-chat-typing">Thinking…</div>
        )}
        {completed && (
          <div className={`op-insp-result-inline op-insp-result-${completed.outcome ?? 'pass'}`}>
            <div className="op-insp-result-badge">{(completed.outcome ?? 'pass').toUpperCase()}</div>
            <div className="op-chat-complete-title">Inspection complete</div>
            {completed.summary && <div className="op-chat-complete-sub">{completed.summary}</div>}
            <button
              type="button"
              className="op-ci-btn op-ci-btn-fill"
              onClick={() => onDone(completed.outcome ?? 'pass')}
            >
              Done · check in
            </button>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {error && <div className="op-insp-error">{error}</div>}

      {!completed && (
        <div className="op-chat-input">
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
            disabled={streaming}
          />
          <button
            type="button"
            className="op-chat-send"
            onClick={() => send(input)}
            disabled={streaming || !input.trim()}
            aria-label="Send"
          >
            <Icon f7="arrow_up_circle_fill" />
          </button>
        </div>
      )}
    </div>
  );
}
