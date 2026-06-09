import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSessionContext } from '@/lib/getSessionContext';
import { getTemplate } from '@/lib/inspections/repo';
import { listResponses } from '@/lib/inspections/responses';
import { listMachinesForAccount } from '@/lib/machines';
import { listSitesForAccount } from '@/lib/sites';

export const dynamic = 'force-dynamic';

export default async function TemplateResponsesPage({
  params,
}: {
  params: { id: string };
}) {
  const ctx = await getSessionContext();
  const tpl = await getTemplate(ctx.accountId, params.id);
  if (!tpl) notFound();

  const [responses, machines, sites] = await Promise.all([
    listResponses(ctx.accountId, { templateId: tpl.id, limit: 200 }),
    listMachinesForAccount(ctx.accountId),
    listSitesForAccount(ctx.accountId),
  ]);
  const machineName = Object.fromEntries(machines.map((m) => [m.id, m.name]));
  const siteName = Object.fromEntries(sites.map((s) => [s.id, s.name]));

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-3 text-sm mb-3">
        <Link
          href={`/inspections/${tpl.id}`}
          className="text-slate-500 hover:text-slate-900 inline-flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {tpl.name}
        </Link>
      </div>

      <h1 className="text-xl font-bold text-slate-900">Completed responses</h1>
      <p className="text-sm text-slate-500 mt-0.5">
        {responses.length} submission{responses.length === 1 ? '' : 's'} for{' '}
        <span className="font-mono text-amber-600">/{tpl.handle}</span>.
      </p>

      {responses.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          No submissions yet. Once an operator runs this inspection on a machine, it will show up here.
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs text-slate-500 uppercase tracking-wide">
                <th className="px-3 py-2 font-semibold">Submitted</th>
                <th className="px-3 py-2 font-semibold">Machine</th>
                <th className="px-3 py-2 font-semibold">Site</th>
                <th className="px-3 py-2 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {responses.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2 text-slate-700">
                    {new Date(r.submittedAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-slate-900 font-medium">
                    {r.machineId ? machineName[r.machineId] ?? '(deleted)' : '—'}
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    {r.siteId ? siteName[r.siteId] ?? '(deleted)' : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/inspections/${tpl.id}/responses/${r.id}`}
                      className="text-brand-700 hover:text-brand-800 text-xs font-medium"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
