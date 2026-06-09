import Link from 'next/link';
import { MachineCard } from '@/components/MachineCard';
import { fetchFleet, PAGE_SIZE } from '@/lib/trackunit-api';
import type { Asset } from '@/lib/types';

export const dynamic = 'force-dynamic';

function LegacyBanner() {
  return (
    <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <span className="font-semibold">Legacy debug view.</span>{' '}
      This page reads Trackunit credentials directly from <code className="bg-amber-100 px-1 py-0.5 rounded">.env.local</code> and bypasses auth. It will be removed once the new fleet workflow is solid.{' '}
      <Link href="/fleet" className="underline font-medium">Go to the new /fleet →</Link>
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl ring-1 ring-slate-200 overflow-hidden animate-pulse">
      <div className="aspect-video bg-slate-100" />
      <div className="p-4 space-y-3">
        <div className="flex justify-between gap-4">
          <div className="space-y-1.5 flex-1">
            <div className="h-4 bg-slate-100 rounded w-3/4" />
            <div className="h-3 bg-slate-100 rounded w-1/2" />
          </div>
          <div className="h-6 w-20 bg-slate-100 rounded-full" />
        </div>
        <div className="grid grid-cols-2 gap-3 py-3 border-t border-b border-slate-100">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-1">
              <div className="h-2.5 bg-slate-100 rounded w-1/2" />
              <div className="h-3.5 bg-slate-100 rounded w-1/3" />
              <div className="h-1.5 bg-slate-100 rounded w-full" />
            </div>
          ))}
        </div>
        <div className="flex justify-between items-center">
          <div className="h-3 bg-slate-100 rounded w-2/5" />
          <div className="h-7 w-28 bg-slate-100 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

void SkeletonCard; // referenced if needed for Suspense fallback later

// ─── Error state ─────────────────────────────────────────────────────────────

function ErrorState({ message }: { message: string }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-24 text-center">
      <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-4">
        <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.07 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      </div>
      <h3 className="font-semibold text-slate-900 mb-1">Could not load fleet</h3>
      <p className="text-sm text-slate-500 max-w-sm">{message}</p>
      <p className="text-xs text-slate-400 mt-3">
        Check your <code className="bg-slate-100 px-1 py-0.5 rounded">.env.local</code> credentials and restart the dev server.
      </p>
    </div>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function Pagination({
  page,
  totalPages,
  totalCount,
}: {
  page: number;
  totalPages: number;
  totalCount: number;
}) {
  const start = page * PAGE_SIZE + 1;
  const end   = Math.min((page + 1) * PAGE_SIZE, totalCount);

  return (
    <div className="flex items-center justify-between mt-8 pt-5 border-t border-slate-100">
      <p className="text-sm text-slate-500">
        Showing{' '}
        <span className="font-medium text-slate-700">{start}–{end}</span> of{' '}
        <span className="font-medium text-slate-700">{totalCount}</span> machines
      </p>

      <div className="flex items-center gap-2">
        {page > 0 ? (
          <Link
            href={`/trackunit-debug?page=${page - 1}`}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium
              bg-white ring-1 ring-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Previous
          </Link>
        ) : (
          <span className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium
            bg-slate-50 ring-1 ring-slate-100 text-slate-300 cursor-not-allowed select-none">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Previous
          </span>
        )}

        <span className="text-sm text-slate-500 tabular-nums px-1">
          {page + 1} / {totalPages}
        </span>

        {page < totalPages - 1 ? (
          <Link
            href={`/trackunit-debug?page=${page + 1}`}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium
              bg-white ring-1 ring-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Next
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        ) : (
          <span className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium
            bg-slate-50 ring-1 ring-slate-100 text-slate-300 cursor-not-allowed select-none">
            Next
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function FleetPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const page = Math.max(0, parseInt(searchParams.page ?? '0', 10));

  let assets: Asset[]      = [];
  let totalCount           = 0;
  let totalPages           = 1;
  let error: string | null = null;

  try {
    const data = await fetchFleet(page);
    assets     = data.assets;
    totalCount = data.totalCount;
    totalPages = data.totalPages;
  } catch (err) {
    error = err instanceof Error ? err.message : 'Unknown error';
  }

  return (
    <div>
      <LegacyBanner />
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">My Fleet</h1>
          {!error && (
            <p className="text-sm text-slate-500 mt-0.5">
              {totalCount} machine{totalCount !== 1 ? 's' : ''} · synced from Trackunit
            </p>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {error ? (
          <ErrorState message={error} />
        ) : assets.length === 0 ? (
          <div className="col-span-full text-center py-24 text-slate-400">
            <p className="text-sm">No machines found in this Trackunit account.</p>
          </div>
        ) : (
          assets.map((asset) => <MachineCard key={asset.assetId} asset={asset} />)
        )}
      </div>

      {/* Pagination */}
      {!error && totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} totalCount={totalCount} />
      )}
    </div>
  );
}
