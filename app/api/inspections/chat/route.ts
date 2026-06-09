import { NextRequest } from 'next/server';
import { getSessionContext } from '@/lib/getSessionContext';
import { getTemplate, updateTemplate } from '@/lib/inspections/repo';
import { getOpenAI, MAX_TOKENS, MODEL } from '@/lib/inspections/llm';
import { AUTHOR_SYSTEM_PROMPT } from '@/lib/inspections/prompts';
import { validateIntentYaml } from '@/lib/inspections/yaml-schema';
import type { ChatMessage } from '@/lib/inspections/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  templateId: string;
  userMessage: string;
}

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: NextRequest) {
  const ctx = await getSessionContext();
  const { templateId, userMessage } = (await req.json()) as Body;

  if (!templateId || typeof userMessage !== 'string' || !userMessage.trim()) {
    return new Response('Invalid body', { status: 400 });
  }

  const tpl = await getTemplate(ctx.accountId, templateId);
  if (!tpl) return new Response('Not found', { status: 404 });
  if (tpl.kind !== 'intent') return new Response('Wrong template kind', { status: 400 });

  const history: ChatMessage[] = tpl.chat_history ?? [];
  const userMsg: ChatMessage = {
    role: 'user',
    content: userMessage,
    ts: new Date().toISOString(),
  };

  const system =
    AUTHOR_SYSTEM_PROMPT +
    `\n\nCURRENT YAML:\n\`\`\`yaml\n${tpl.yaml_body ?? ''}\n\`\`\``;

  const messages = [
    { role: 'system' as const, content: system },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: userMessage },
  ];

  const openai = getOpenAI();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let proseAccum = '';
      // OpenAI streams tool-call argument JSON as string fragments, one set per
      // tool_call index. Accumulate per index so we can JSON.parse at the end.
      const toolArgs: Record<number, { name: string; args: string }> = {};
      let validatedYaml: string | null = null;
      let validationError: string | null = null;

      try {
        const llmStream = await openai.chat.completions.create({
          model: MODEL,
          stream: true,
          max_tokens: MAX_TOKENS,
          messages,
          tools: [
            {
              type: 'function',
              function: {
                name: 'update_yaml',
                description:
                  'Replace the entire YAML body for this intent. Output MUST conform to the fixed top-level schema (intent_id, pattern, intent, when, data_known, operator_verified, conditional, escalation, extraction, audience).',
                parameters: {
                  type: 'object',
                  required: ['yaml'],
                  properties: { yaml: { type: 'string' } },
                },
              },
            },
          ],
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

        // Look for an update_yaml tool call; parse + validate.
        for (const entry of Object.values(toolArgs)) {
          if (entry.name !== 'update_yaml') continue;
          try {
            const parsed = JSON.parse(entry.args) as { yaml?: string };
            if (typeof parsed.yaml === 'string') {
              const v = validateIntentYaml(parsed.yaml);
              if (v.ok) {
                validatedYaml = parsed.yaml;
              } else {
                validationError = v.error ?? 'YAML validation failed';
              }
            }
          } catch (e) {
            validationError = `Tool argument JSON parse failed: ${(e as Error).message}`;
          }
        }

        const assistantMsg: ChatMessage = {
          role: 'assistant',
          content: proseAccum,
          ts: new Date().toISOString(),
        };
        const newHistory = [...history, userMsg, assistantMsg];

        await updateTemplate(ctx.accountId, templateId, {
          chatHistory: newHistory,
          yamlBody: validatedYaml ?? undefined,
        });

        if (validatedYaml) {
          controller.enqueue(encoder.encode(sse('yaml', { yaml: validatedYaml })));
        } else if (validationError) {
          controller.enqueue(
            encoder.encode(
              sse('prose', {
                delta: `\n\n_(Skipped YAML update: ${validationError})_`,
              })
            )
          );
        }

        controller.enqueue(encoder.encode(sse('done', {})));
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
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
