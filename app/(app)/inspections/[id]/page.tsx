import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSessionContext } from '@/lib/getSessionContext';
import { getTemplate } from '@/lib/inspections/repo';
import {
  distinctAssetTypes,
  listAssignmentsForTemplate,
} from '@/lib/inspections/assignments';
import { listMachinesForAccount } from '@/lib/machines';
import { listSitesForAccount } from '@/lib/sites';
import { AssignmentPanel } from './AssignmentPanel';
import { FormEditor } from './FormEditor';
import { IntentEditor } from './IntentEditor';
import { TemplateHeader } from './TemplateHeader';

export const dynamic = 'force-dynamic';

export default async function InspectionEditPage({ params }: { params: { id: string } }) {
  const ctx = await getSessionContext();
  const [tpl, assignments, sites, machines] = await Promise.all([
    getTemplate(ctx.accountId, params.id),
    listAssignmentsForTemplate(ctx.accountId, params.id),
    listSitesForAccount(ctx.accountId),
    listMachinesForAccount(ctx.accountId),
  ]);
  if (!tpl) notFound();

  const assetTypes = distinctAssetTypes(machines);

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center gap-3 text-sm">
        <Link href="/inspections" className="text-slate-500 hover:text-slate-900 inline-flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Inspections
        </Link>
      </div>

      <TemplateHeader template={tpl} />

      <AssignmentPanel
        templateId={tpl.id}
        assignments={assignments}
        sites={sites}
        machines={machines}
        assetTypes={assetTypes}
      />

      {tpl.kind === 'form' ? (
        <FormEditor template={tpl} />
      ) : (
        <IntentEditor template={tpl} />
      )}
    </div>
  );
}
