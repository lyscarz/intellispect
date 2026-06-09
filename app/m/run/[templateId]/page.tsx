import { notFound } from 'next/navigation';
import { getSessionContext } from '@/lib/getSessionContext';
import { getTemplate } from '@/lib/inspections/repo';
import { getMachine } from '@/lib/machines';
import { getSite } from '@/lib/sites';
import { buildMachineContext } from '@/lib/inspections/assignments';
import { Runner } from './Runner';

export const dynamic = 'force-dynamic';

export default async function RunPage({
  params,
  searchParams,
}: {
  params: { templateId: string };
  searchParams: { machineId?: string; siteId?: string };
}) {
  const ctx = await getSessionContext();
  const template = await getTemplate(ctx.accountId, params.templateId);
  if (!template) notFound();
  if (template.kind !== 'form' || !template.form_schema) notFound();

  const machineId = searchParams.machineId ?? null;
  const siteId = searchParams.siteId ?? null;

  let machineContext = null;
  if (machineId) {
    const machine = await getMachine(machineId, ctx.accountId);
    if (machine) {
      const site = machine.siteId ? await getSite(machine.siteId, ctx.accountId) : null;
      machineContext = buildMachineContext(machine, site?.name ?? null);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Runner template={template} machine={machineContext} siteId={siteId} />
    </div>
  );
}
