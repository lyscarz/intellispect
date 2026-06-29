import { NextRequest } from 'next/server';
import {
  resolveApiSession,
  resolveAccountForMachine,
  ApiAuthError,
  corsHeaders,
  corsPreflight,
} from '@/lib/apiSession';
import { getMachine } from '@/lib/machines';
import { getSite } from '@/lib/sites';
import { getTemplate } from '@/lib/inspections/repo';
import {
  completeIntentRun,
  getIntentRun,
  getLastCompletedRun,
} from '@/lib/inspections/runs';
import { buildPreflightInputs } from '@/lib/inspections/preflight';
import { getOpenAI, MAX_TOKENS, MODEL } from '@/lib/inspections/llm';
import { runIntentSystemPrompt } from '@/lib/inspections/prompts';
import type { ChatMessage, MachineContext, Outcome } from '@/lib/inspections/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface InboundMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface Body {
  templateId: string;
  messages: InboundMessage[];
  machine?: MachineContext | null;
  /** Optional run id from /api/inspections/runs/intent-start. When provided, a
   *  complete_inspection tool call from the model will finalise the run. */
  runId?: string | null;
}

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function POST(req: NextRequest) {
  const cors = corsHeaders(req.headers.get('origin'));
  let ctx;
  try {
    ctx = await resolveApiSession(req);
  } catch (e) {
    if (e instanceof ApiAuthError) {
      return new Response(e.message, { status: e.status, headers: cors });
    }
    throw e;
  }
  const { templateId, messages, machine, runId } = (await req.json()) as Body;

  if (!templateId || !Array.isArray(messages)) {
    return new Response('Invalid body', { status: 400, headers: cors });
  }

  // Resolve the account from the machine itself (the operator may be in several).
  const accountId = machine?.id
    ? (await resolveAccountForMachine(ctx.userId, machine.id)) ?? ctx.accountId
    : ctx.accountId;

  const tpl = await getTemplate(accountId, templateId);
  if (!tpl) return new Response('Not found', { status: 404, headers: cors });
  if (tpl.kind !== 'intent' || !tpl.yaml_body) {
    return new Response('Template is missing a YAML body', { status: 400, headers: cors });
  }

  // Gather PreflightInputs so the AI can reason about machine state + history.
  // Cheap (a couple of indexed queries) and freshens between turns automatically.
  let preflightInputs = null;
  if (machine?.id) {
    const machineRow = await getMachine(machine.id, accountId);
    if (machineRow) {
      const [lastRun, site] = await Promise.all([
        getLastCompletedRun(accountId, machineRow.id, templateId),
        machineRow.siteId ? getSite(machineRow.siteId, accountId) : Promise.resolve(null),
      ]);
      preflightInputs = buildPreflightInputs(
        machineRow,
        site?.name ?? null,
        lastRun,
        ctx.userId
      );
    }
  }

  const openai = getOpenAI();
  const system = runIntentSystemPrompt(tpl.yaml_body, machine ?? null, preflightInputs);

  // Seed the kickoff turn if the runner just opened the chat.
  const inbound =
    messages.length === 0
      ? [{ role: 'user' as const, content: 'Begin the inspection.' }]
      : messages;

  const llmMessages = [
    { role: 'system' as const, content: system },
    ...inbound,
  ];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let proseAccum = '';
      const toolArgs: Record<number, { name: string; args: string }> = {};

      try {
        const llmStream = await openai.chat.completions.create({
          model: MODEL,
          stream: true,
          max_tokens: MAX_TOKENS,
          messages: llmMessages,
          tools: runId
            ? [
                {
                  type: 'function',
                  function: {
                    name: 'complete_inspection',
                    description:
                      'Finalise this inspection. Call when the YAML extraction block is fully satisfied. After calling, stop sending messages.',
                    parameters: {
                      type: 'object',
                      required: ['outcome', 'summary', 'findings'],
                      properties: {
                        outcome: {
                          type: 'string',
                          enum: ['pass', 'attention', 'fail'],
                          description:
                            'pass = machine OK to operate; attention = minor concerns surfaced; fail = do NOT operate, escalate.',
                        },
                        summary: { type: 'string' },
                        findings: { type: 'object', additionalProperties: true },
                        recommendations: {
                          type: 'array',
                          items: { type: 'string' },
                          description:
                            'Short actionable bullets for the manager / fleet team — e.g. "Do not operate until hydraulic system is checked."',
                        },
                      },
                    },
                  },
                },
              ]
            : undefined,
        });

        for await (const chunk of llmStream) {
          const delta = chunk.choices[0]?.delta;
          if (!delta) continue;
          if (delta.content) {
            proseAccum += delta.content;
            controller.enqueue(encoder.encode(sse('prose', { delta: delta.content })));
          }
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0;
              if (!toolArgs[idx]) toolArgs[idx] = { name: '', args: '' };
              if (tc.function?.name) toolArgs[idx].name = tc.function.name;
              if (tc.function?.arguments) toolArgs[idx].args += tc.function.arguments;
            }
          }
        }

        // Did the model call complete_inspection? Persist + emit completion.
        let completed = false;
        let summary: string | undefined;
        let findings: Record<string, unknown> | undefined;
        let outcome: Outcome | undefined;
        let recommendations: string[] | undefined;
        if (runId) {
          for (const entry of Object.values(toolArgs)) {
            if (entry.name !== 'complete_inspection') continue;
            try {
              const parsed = JSON.parse(entry.args) as {
                summary?: string;
                findings?: Record<string, unknown>;
                outcome?: Outcome;
                recommendations?: string[];
              };
              if (typeof parsed.summary === 'string') {
                summary = parsed.summary;
                findings = parsed.findings;
                outcome = parsed.outcome ?? 'pass';
                recommendations = parsed.recommendations;
                // Fold recommendations into findings so the detail page can render
                // them from a single source even if the AI forgot to use the field.
                if (recommendations && recommendations.length > 0 && findings) {
                  findings = { ...findings, recommendations };
                } else if (recommendations && recommendations.length > 0) {
                  findings = { recommendations };
                }
                completed = true;
              }
            } catch {
              // Ignore malformed tool args; transcript is still saved on next non-tool turn.
            }
          }

          if (completed && summary) {
            // Build the full transcript: existing inbound + the assistant's final prose.
            const transcript: ChatMessage[] = [
              ...inbound.map((m) => ({
                role: m.role,
                content: m.content,
                ts: new Date().toISOString(),
              })),
            ];
            if (proseAccum) {
              transcript.push({
                role: 'assistant',
                content: proseAccum,
                ts: new Date().toISOString(),
              });
            }
            // Belt-and-braces: confirm the run still belongs to this account.
            const existing = await getIntentRun(accountId, runId);
            if (existing) {
              await completeIntentRun(accountId, runId, {
                transcript,
                summary,
                findings,
                outcome,
              });
            }
          }
        }

        controller.enqueue(
          encoder.encode(
            sse(
              'done',
              completed
                ? { completed: true, summary, findings, outcome, recommendations }
                : {}
            )
          )
        );
      } catch (e) {
        controller.enqueue(
          encoder.encode(sse('error', { message: (e as Error).message }))
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...cors,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
