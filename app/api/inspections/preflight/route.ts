import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@/lib/getSessionContext';
import { getMachine } from '@/lib/machines';
import { getSite } from '@/lib/sites';
import { getTemplate } from '@/lib/inspections/repo';
import { getLastCompletedRun } from '@/lib/inspections/runs';
import { buildPreflightInputs } from '@/lib/inspections/preflight';
import { getOpenAI, MAX_TOKENS, MODEL } from '@/lib/inspections/llm';
import { PREFLIGHT_SYSTEM_PROMPT } from '@/lib/inspections/prompts';
import type { PreflightVerdict } from '@/lib/inspections/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  machineId: string;
  templateId: string;
}

export async function POST(req: NextRequest) {
  const ctx = await getSessionContext();
  const { machineId, templateId } = (await req.json()) as Body;
  if (!machineId || !templateId) {
    return NextResponse.json({ error: 'machineId + templateId required' }, { status: 400 });
  }

  const [machine, template, lastRun] = await Promise.all([
    getMachine(machineId, ctx.accountId),
    getTemplate(ctx.accountId, templateId),
    getLastCompletedRun(ctx.accountId, machineId, templateId),
  ]);
  if (!machine) return NextResponse.json({ error: 'Machine not found' }, { status: 404 });
  if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

  const site = machine.siteId ? await getSite(machine.siteId, ctx.accountId) : null;
  const inputs = buildPreflightInputs(machine, site?.name ?? null, lastRun, ctx.userId);

  const openai = getOpenAI();
  const completion = await openai.chat.completions.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [
      { role: 'system', content: PREFLIGHT_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Template: ${template.name} (/${template.handle}, kind=${template.kind})\n\nINPUTS:\n${JSON.stringify(inputs, null, 2)}`,
      },
    ],
    tools: [
      {
        type: 'function',
        function: {
          name: 'emit_verdict',
          description: 'Emit the pre-inspection verdict. Call exactly once.',
          parameters: {
            type: 'object',
            required: ['recommendation', 'reasoning', 'briefing'],
            properties: {
              recommendation: { type: 'string', enum: ['proceed', 'heightened', 'skip'] },
              reasoning: { type: 'string' },
              briefing: { type: 'string' },
              focus_items: { type: 'array', items: { type: 'string' } },
            },
          },
        },
      },
    ],
    tool_choice: { type: 'function', function: { name: 'emit_verdict' } },
  });

  const toolCall = completion.choices[0]?.message?.tool_calls?.[0];
  const fnArgs =
    toolCall && toolCall.type === 'function' ? toolCall.function.arguments : null;

  if (!fnArgs) {
    // Fallback: best-effort default verdict so the UI still moves forward.
    const verdict: PreflightVerdict = {
      recommendation: 'proceed',
      reasoning: 'Pre-flight analysis was unavailable. Proceeding with default settings.',
      briefing: '',
    };
    return NextResponse.json({ verdict, inputs });
  }

  let verdict: PreflightVerdict;
  try {
    const parsed = JSON.parse(fnArgs) as {
      recommendation: PreflightVerdict['recommendation'];
      reasoning: string;
      briefing: string;
      focus_items?: string[];
    };
    verdict = {
      recommendation: parsed.recommendation,
      reasoning: parsed.reasoning,
      briefing: parsed.briefing,
      focusItems: parsed.focus_items,
    };
  } catch (e) {
    verdict = {
      recommendation: 'proceed',
      reasoning: `Pre-flight returned malformed verdict (${(e as Error).message}). Proceeding.`,
      briefing: '',
    };
  }

  return NextResponse.json({ verdict, inputs });
}
