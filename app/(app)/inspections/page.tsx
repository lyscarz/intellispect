import Link from 'next/link';
import { getSessionContext } from '@/lib/getSessionContext';
import { listTemplates } from '@/lib/inspections/repo';
import type { InspectionTemplate } from '@/lib/inspections/types';

export const dynamic = 'force-dynamic';

export default async function InspectionsPage() {
  const ctx = await getSessionContext();
  const templates = await listTemplates(ctx.accountId);

  return (
    <div className="max-w-5xl">
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

      <div className="mt-2 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Build &amp; manage templates</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Author the inspections your operators run from their devices. Form-based or AI-driven.
          </p>
        </div>
        <Link
          href="/inspections/new"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New inspection
        </Link>
      </div>

      {templates.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <TemplateCard key={t.id} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}

function TemplateCard({ t }: { t: InspectionTemplate }) {
  return (
    <Link
      href={`/inspections/${t.id}`}
      className="group block rounded-xl border border-slate-200 bg-white p-4 hover:border-brand-300 hover:shadow-sm transition"
    >
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${
            t.kind === 'intent' ? 'bg-violet-100 text-violet-700' : 'bg-sky-100 text-sky-700'
          }`}
        >
          {t.kind === 'intent' ? 'AI' : 'Form'}
        </span>
        <span
          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${
            t.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
          }`}
        >
          {t.status}
        </span>
      </div>
      <div className="mt-2 font-mono text-xs text-amber-600">/{t.handle}</div>
      <div className="mt-0.5 font-semibold text-slate-900 truncate">{t.name}</div>
      {t.description && (
        <div className="mt-1 text-xs text-slate-500 line-clamp-2">{t.description}</div>
      )}
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white py-16 px-6 text-center">
      <div className="mx-auto w-12 h-12 rounded-full bg-brand-50 flex items-center justify-center mb-3">
        <svg
          className="w-6 h-6 text-brand-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.75}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
          />
        </svg>
      </div>
      <h3 className="font-semibold text-slate-900">No inspections yet</h3>
      <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
        Create your first inspection — a standard form your operators fill out, or an intent-driven
        conversation guided by AI.
      </p>
      <Link
        href="/inspections/new"
        className="mt-4 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700"
      >
        New inspection
      </Link>
    </div>
  );
}
