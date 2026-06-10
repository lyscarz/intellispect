import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSessionContext } from '@/lib/getSessionContext';
import { getMachine } from '@/lib/machines';
import { getSite } from '@/lib/sites';
import { getTemplate } from '@/lib/inspections/repo';
import { buildMachineContext } from '@/lib/inspections/assignments';
import { buildPreflightInputs } from '@/lib/inspections/preflight';
import { getLastCompletedRun, startIntentRun } from '@/lib/inspections/runs';
import { MobileIntentRunner } from '@/app/(app)/inspections/[id]/MobileIntentRunner';

export const dynamic = 'force-dynamic';

interface Props {
  params: { templateId: string };
  searchParams: { machineId?: string };
}

export default async function MobileIntentRunPage({ params, searchParams }: Props) {
  const machineId = searchParams.machineId;
  if (!machineId) notFound();

  const ctx = await getSessionContext();

  const [template, machine] = await Promise.all([
    getTemplate(ctx.accountId, params.templateId),
    getMachine(machineId, ctx.accountId),
  ]);
  if (!template) notFound();
  if (template.kind !== 'intent' || !template.yaml_body) notFound();
  if (!machine) notFound();

  const [lastRun, site] = await Promise.all([
    getLastCompletedRun(ctx.accountId, machine.id, template.id),
    machine.siteId ? getSite(machine.siteId, ctx.accountId) : Promise.resolve(null),
  ]);

  const machineContext = buildMachineContext(machine, site?.name ?? null);
  const preflightInputs = buildPreflightInputs(
    machine,
    site?.name ?? null,
    lastRun,
    ctx.userId
  );

  // Create the run row up-front so the AI's complete_inspection tool has
  // somewhere to write. The preflight inputs are stored on the run for audit.
  const snap = machine.lastSnapshot;
  const { id: runId } = await startIntentRun({
    accountId: ctx.accountId,
    templateId: template.id,
    machineId: machine.id,
    operatorId: ctx.userId,
    yamlSnapshot: template.yaml_body,
    machineSnapshot: snap,
    preflight: preflightInputs as unknown as Parameters<typeof startIntentRun>[0]['preflight'],
    engineHoursAtStart: snap?.insights.cumulativeEngineHours ?? null,
    operatingHoursAtStart: snap?.insights.cumulativeOperatingHours ?? null,
  });

  return (
    <div className="flex flex-col min-h-screen">
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-2 flex items-center gap-2">
        <Link
          href={`/m/machine/${machine.id}`}
          className="inline-flex items-center gap-1 text-sm text-slate-500"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {machine.name}
        </Link>
        <div className="flex-1" />
        <span className="text-[10px] uppercase tracking-wide font-semibold bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded">
          AI
        </span>
      </header>
      {/* MobileIntentRunner is a client component — handed the runId so the
          AI's complete_inspection tool persists results. Pass machine context
          (so the AI greets the operator naturally) but NOT aiContext (the
          debug expander is admin-only; operators don't see the raw JSON). */}
      <MobileIntentRunner
        template={template}
        machine={machineContext}
        runId={runId}
      />
    </div>
  );
}
