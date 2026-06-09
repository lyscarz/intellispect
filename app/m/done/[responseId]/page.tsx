import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSessionContext } from '@/lib/getSessionContext';
import { getResponse } from '@/lib/inspections/responses';
import { getTemplate } from '@/lib/inspections/repo';
import { getMachine } from '@/lib/machines';

export const dynamic = 'force-dynamic';

export default async function DonePage({ params }: { params: { responseId: string } }) {
  const ctx = await getSessionContext();
  const response = await getResponse(ctx.accountId, params.responseId);
  if (!response) notFound();

  const [template, machine] = await Promise.all([
    getTemplate(ctx.accountId, response.templateId),
    response.machineId ? getMachine(response.machineId, ctx.accountId) : Promise.resolve(null),
  ]);

  const submittedAt = new Date(response.submittedAt);

  return (
    <div className="px-4 py-6 max-w-screen-sm mx-auto text-center">
      <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h1 className="text-xl font-bold">Inspection submitted</h1>
      <p className="text-sm text-slate-500 mt-1">
        {template?.name ?? 'Inspection'}
        {machine ? ` · ${machine.name}` : ''}
      </p>
      <p className="text-xs text-slate-400 mt-0.5">
        {submittedAt.toLocaleString()}
      </p>

      <div className="mt-6 grid gap-2">
        {machine && (
          <Link
            href={`/m/machine/${machine.id}`}
            className="rounded-xl bg-brand-600 text-white text-sm font-semibold py-3"
          >
            Inspect this machine again
          </Link>
        )}
        <Link
          href="/m"
          className="rounded-xl bg-white border border-slate-300 text-slate-700 text-sm font-semibold py-3"
        >
          Pick another machine
        </Link>
      </div>
    </div>
  );
}
