import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSessionContext } from '@/lib/getSessionContext';
import { getMachine } from '@/lib/machines';
import { getSite } from '@/lib/sites';
import { getTemplate } from '@/lib/inspections/repo';
import { getResponse } from '@/lib/inspections/responses';
import { getIntentRun } from '@/lib/inspections/runs';
import { listEscalations } from '@/lib/inspections/escalations';
import { RunDetailHeader } from './RunDetailHeader';
import { FormRunDetail } from './FormRunDetail';
import { IntentRunDetail } from './IntentRunDetail';
import { EscalationPanel } from './EscalationPanel';

export const dynamic = 'force-dynamic';

export default async function InspectionRunDetailPage({
  params,
}: {
  params: { kind: string; id: string };
}) {
  if (params.kind !== 'form' && params.kind !== 'intent') notFound();
  const ctx = await getSessionContext();

  if (params.kind === 'form') {
    const [response, escalations] = await Promise.all([
      getResponse(ctx.accountId, params.id),
      listEscalations(ctx.accountId, { responseId: params.id }),
    ]);
    if (!response) notFound();
    const [template, machine] = await Promise.all([
      getTemplate(ctx.accountId, response.templateId),
      response.machineId ? getMachine(response.machineId, ctx.accountId) : Promise.resolve(null),
    ]);
    const site = machine?.siteId ? await getSite(machine.siteId, ctx.accountId) : null;

    return (
      <div className="max-w-4xl flex flex-col gap-4">
        <BackLink />
        <RunDetailHeader
          kind="form"
          templateName={template?.name ?? '(deleted template)'}
          templateHandle={template?.handle ?? '?'}
          machineName={machine?.name ?? null}
          machineBrand={machine?.brand ?? null}
          machineModel={machine?.model ?? null}
          siteName={site?.name ?? null}
          startedAt={response.submittedAt}
          completedAt={response.submittedAt}
          status={response.status}
          outcome={response.outcome}
        />
        <EscalationPanel
          existing={escalations}
          target={{ responseId: response.id, machineId: response.machineId }}
        />
        <FormRunDetail response={response} />
      </div>
    );
  }

  // Intent
  const [intentRun, escalations] = await Promise.all([
    getIntentRun(ctx.accountId, params.id),
    listEscalations(ctx.accountId, { intentRunId: params.id }),
  ]);
  if (!intentRun) notFound();
  const [template, machine] = await Promise.all([
    getTemplate(ctx.accountId, intentRun.templateId),
    intentRun.machineId ? getMachine(intentRun.machineId, ctx.accountId) : Promise.resolve(null),
  ]);
  const site = machine?.siteId ? await getSite(machine.siteId, ctx.accountId) : null;

  return (
    <div className="max-w-4xl flex flex-col gap-4">
      <BackLink />
      <RunDetailHeader
        kind="intent"
        templateName={template?.name ?? '(deleted template)'}
        templateHandle={template?.handle ?? '?'}
        machineName={machine?.name ?? null}
        machineBrand={machine?.brand ?? null}
        machineModel={machine?.model ?? null}
        siteName={site?.name ?? null}
        startedAt={intentRun.startedAt}
        completedAt={intentRun.completedAt}
        status={intentRun.status}
        outcome={intentRun.outcome}
      />
      <EscalationPanel
        existing={escalations}
        target={{ intentRunId: intentRun.id, machineId: intentRun.machineId }}
      />
      <IntentRunDetail run={intentRun} />
    </div>
  );
}

function BackLink() {
  return (
    <div className="text-sm">
      <Link
        href="/inspection-history"
        className="text-slate-500 hover:text-slate-900 inline-flex items-center gap-1"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Inspections
      </Link>
    </div>
  );
}
