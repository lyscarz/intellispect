'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import type { InspectionResponse, InspectionTemplate } from '@/lib/inspections/types';
import type { Machine, Site } from '@/lib/types';

interface Props {
  responses: InspectionResponse[];
  templates: InspectionTemplate[];
  machines: Machine[];
  sites: Site[];
  filters: { template?: string; machine?: string; site?: string };
}

export function ResponsesTable({ responses, templates, machines, sites, filters }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const templateName = useMemo(
    () => Object.fromEntries(templates.map((t) => [t.id, t.name])),
    [templates]
  );
  const machineName = useMemo(
    () => Object.fromEntries(machines.map((m) => [m.id, m.name])),
    [machines]
  );
  const siteName = useMemo(
    () => Object.fromEntries(sites.map((s) => [s.id, s.name])),
    [sites]
  );

  function updateFilter(key: 'template' | 'machine' | 'site', value: string | null) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white p-3 mb-3 flex flex-wrap items-center gap-2">
        <FilterSelect
          label="Template"
          value={filters.template ?? ''}
          options={templates.map((t) => ({ value: t.id, label: t.name }))}
          onChange={(v) => updateFilter('template', v)}
        />
        <FilterSelect
          label="Machine"
          value={filters.machine ?? ''}
          options={machines.map((m) => ({ value: m.id, label: m.name }))}
          onChange={(v) => updateFilter('machine', v)}
        />
        <FilterSelect
          label="Site"
          value={filters.site ?? ''}
          options={sites.map((s) => ({ value: s.id, label: s.name }))}
          onChange={(v) => updateFilter('site', v)}
        />
        {(filters.template || filters.machine || filters.site) && (
          <button
            type="button"
            onClick={() => router.push(pathname)}
            className="text-xs text-slate-500 hover:text-slate-900 underline"
          >
            Clear filters
          </button>
        )}
        <div className="flex-1" />
        <div className="text-xs text-slate-500">
          {responses.length} response{responses.length === 1 ? '' : 's'}
        </div>
      </div>

      {responses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          No inspections submitted yet.
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs text-slate-500 uppercase tracking-wide">
                <th className="px-3 py-2 font-semibold">Submitted</th>
                <th className="px-3 py-2 font-semibold">Template</th>
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
                    {templateName[r.templateId] ?? '(deleted template)'}
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    {r.machineId ? machineName[r.machineId] ?? '(deleted)' : '—'}
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    {r.siteId ? siteName[r.siteId] ?? '(deleted)' : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/inspections/${r.templateId}/responses/${r.id}`}
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
    </>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string | null) => void;
}) {
  return (
    <label className="inline-flex items-center gap-1.5 text-xs text-slate-500">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value || null)}
        className="px-2 py-1.5 rounded-md border border-slate-300 bg-white text-xs"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
