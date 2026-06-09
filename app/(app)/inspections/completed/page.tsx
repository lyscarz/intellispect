import Link from 'next/link';
import { getSessionContext } from '@/lib/getSessionContext';
import { listResponses } from '@/lib/inspections/responses';
import { listTemplates } from '@/lib/inspections/repo';
import { listMachinesForAccount } from '@/lib/machines';
import { listSitesForAccount } from '@/lib/sites';
import { ResponsesTable } from './ResponsesTable';

export const dynamic = 'force-dynamic';

export default async function CompletedInspectionsPage({
  searchParams,
}: {
  searchParams: { template?: string; machine?: string; site?: string };
}) {
  const ctx = await getSessionContext();
  const [responses, templates, machines, sites] = await Promise.all([
    listResponses(ctx.accountId, {
      templateId: searchParams.template,
      machineId: searchParams.machine,
      siteId: searchParams.site,
      limit: 200,
    }),
    listTemplates(ctx.accountId),
    listMachinesForAccount(ctx.accountId),
    listSitesForAccount(ctx.accountId),
  ]);

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-3 text-sm mb-3">
        <Link
          href="/inspections"
          className="text-slate-500 hover:text-slate-900 inline-flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Inspections
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-bold text-slate-900">Completed inspections</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Every inspection submitted from the field. Filter by template, machine, or site.
        </p>
      </div>

      <div className="mt-4">
        <ResponsesTable
          responses={responses}
          templates={templates}
          machines={machines}
          sites={sites}
          filters={searchParams}
        />
      </div>
    </div>
  );
}
