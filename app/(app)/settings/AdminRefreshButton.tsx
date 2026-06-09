'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

interface AccountResult {
  accountId: string;
  path: 'gql' | 'aemp' | 'none';
  fetched: number;
  updated: number;
  skipped: number;
  error?: string;
  gqlError?: string;
  sitesFetched?: number;
  sitesInserted?: number;
  sitesUpdated?: number;
  sitesLinked?: number;
  sitesError?: string;
}

interface CronResult {
  accounts: number;
  durationMs: number;
  updated: number;
  skipped: number;
  fetched: number;
  errors: number;
  results?: AccountResult[];
}

export function AdminRefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<CronResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (
      !window.confirm(
        'Refresh fleet snapshots from Trackunit for this account now? Normally the background cron handles this automatically every 30 min.'
      )
    ) {
      return;
    }
    setError(null);
    setResult(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/cron/refresh-aemp', { method: 'POST' });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error ?? 'Refresh failed');
          return;
        }
        setResult(json);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Refresh failed');
      }
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg ring-1 ring-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium px-3 py-2 disabled:opacity-50"
      >
        <svg
          className={`w-4 h-4 ${pending ? 'animate-spin' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        {pending ? 'Refreshing…' : 'Refresh fleet snapshots now'}
      </button>
      {result && (
        <div className="mt-2 space-y-2">
          <p className="text-xs text-slate-500">
            Updated {result.updated} machine{result.updated === 1 ? '' : 's'} ·{' '}
            {result.skipped} unchanged · {result.errors > 0 && `${result.errors} errors · `}
            finished in {(result.durationMs / 1000).toFixed(1)}s
          </p>
          {result.results?.map((r) => (
            <div
              key={r.accountId}
              className={`rounded-md border px-3 py-2 text-xs ${
                r.error
                  ? 'border-red-200 bg-red-50'
                  : r.path === 'gql'
                    ? 'border-emerald-200 bg-emerald-50'
                    : 'border-amber-200 bg-amber-50'
              }`}
            >
              <div className="font-medium text-slate-700">
                Path: <code>{r.path}</code> · fetched {r.fetched} · updated {r.updated} · skipped {r.skipped}
              </div>
              {r.gqlError && (
                <div className="mt-1 text-red-700">
                  <span className="font-medium">GraphQL fell back:</span> {r.gqlError}
                </div>
              )}
              {r.sitesFetched !== undefined && (
                <div className="mt-1 text-slate-600">
                  <span className="font-medium">Sites:</span>{' '}
                  fetched {r.sitesFetched} · inserted {r.sitesInserted ?? 0} ·
                  updated {r.sitesUpdated ?? 0} · linked {r.sitesLinked ?? 0} machine
                  {(r.sitesLinked ?? 0) === 1 ? '' : 's'}
                </div>
              )}
              {r.sitesError && (
                <div className="mt-1 text-amber-700">
                  <span className="font-medium">Sites sync error:</span> {r.sitesError}
                </div>
              )}
              {r.error && (
                <div className="mt-1 text-red-700">
                  <span className="font-medium">Error:</span> {r.error}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
