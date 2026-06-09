import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSessionContext } from '@/lib/getSessionContext';
import { getMachine } from '@/lib/machines';
import { getSite } from '@/lib/sites';
import { templatesForMachine } from '@/lib/inspections/assignments';

export const dynamic = 'force-dynamic';

export default async function MachineTemplatePicker({
  params,
}: {
  params: { machineId: string };
}) {
  const ctx = await getSessionContext();
  const machine = await getMachine(params.machineId, ctx.accountId);
  if (!machine) notFound();

  const [templates, site] = await Promise.all([
    templatesForMachine(ctx.accountId, machine),
    machine.siteId ? getSite(machine.siteId, ctx.accountId) : Promise.resolve(null),
  ]);

  const formTemplates = templates.filter((t) => t.kind === 'form');
  const subtitle = [machine.lastSnapshot?.assetType, machine.brand, machine.model]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="px-4 py-3 max-w-screen-sm mx-auto">
      <Link href="/m" className="inline-flex items-center gap-1 text-sm text-slate-500 mb-3">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Machines
      </Link>

      <header className="mb-4">
        <h1 className="text-xl font-bold">{machine.name}</h1>
        {subtitle && <div className="text-xs text-slate-500 mt-0.5">{subtitle}</div>}
        <div className="text-[11px] text-slate-400 mt-0.5">{site?.name ?? machine.site ?? 'No site'}</div>
      </header>

      <h2 className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-2">
        Inspections ({formTemplates.length})
      </h2>

      {formTemplates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
          No active inspections apply to this machine.
        </div>
      ) : (
        <div className="grid gap-2">
          {formTemplates.map((t) => {
            const totalQs =
              t.form_schema?.sections.reduce((n, s) => n + s.questions.length, 0) ?? 0;
            return (
              <Link
                key={t.id}
                href={`/m/run/${t.id}?machineId=${machine.id}${
                  machine.siteId ? `&siteId=${machine.siteId}` : ''
                }`}
                className="rounded-xl bg-white border border-slate-200 p-3 active:bg-slate-100 transition flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{t.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {totalQs} question{totalQs === 1 ? '' : 's'}
                    {t.description ? ` · ${t.description}` : ''}
                  </div>
                </div>
                <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
