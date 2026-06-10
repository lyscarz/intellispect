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
    // Include drafts on the operator side too — the templatesForMachine
    // resolver normally hides drafts; admins testing want to run them.
    // For operators, drafts shouldn't appear — but the filter is downstream
    // controlled and defaults safely. Leaving default (active-only) for now.
    templatesForMachine(ctx.accountId, machine),
    machine.siteId ? getSite(machine.siteId, ctx.accountId) : Promise.resolve(null),
  ]);

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
        <div className="text-[11px] text-slate-400 mt-0.5">
          {site?.name ?? machine.site ?? 'No site'}
        </div>
      </header>

      <h2 className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-2">
        Inspections ({templates.length})
      </h2>

      {templates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
          No active inspections apply to this machine.
        </div>
      ) : (
        <div className="grid gap-2">
          {templates.map((t) => {
            const isIntent = t.kind === 'intent';
            const totalQs =
              t.form_schema?.sections.reduce((n, s) => n + s.questions.length, 0) ?? 0;
            const siteParam = machine.siteId ? `&siteId=${machine.siteId}` : '';
            const href = isIntent
              ? `/m/run-intent/${t.id}?machineId=${machine.id}${siteParam}`
              : `/m/run/${t.id}?machineId=${machine.id}${siteParam}`;
            return (
              <Link
                key={t.id}
                href={href}
                className="rounded-xl bg-white border border-slate-200 p-3 active:bg-slate-100 transition flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${
                        isIntent ? 'bg-violet-100 text-violet-700' : 'bg-sky-100 text-sky-700'
                      }`}
                    >
                      {isIntent ? 'AI' : 'Form'}
                    </span>
                    <span className="font-mono text-[10px] text-amber-600">/{t.handle}</span>
                  </div>
                  <div className="font-semibold truncate">{t.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5 truncate">
                    {isIntent
                      ? t.description ?? 'Conversational inspection'
                      : `${totalQs} question${totalQs === 1 ? '' : 's'}${t.description ? ` · ${t.description}` : ''}`}
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
