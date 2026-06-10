import Link from 'next/link';
import { getSessionContext } from '@/lib/getSessionContext';
import { listAllRuns } from '@/lib/inspections/runs';
import { InspectionHistoryList } from './InspectionHistoryList';

export const dynamic = 'force-dynamic';

export default async function InspectionHistoryPage() {
  const ctx = await getSessionContext();
  const runs = await listAllRuns(ctx.accountId, {
    limit: 100,
    allowedFleetIds: ctx.allowedFleetIds,
  });
  const isOwner = ctx.role === 'account_admin';

  return (
    <div className="max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Inspections</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Every inspection run on this account — both AI-driven and form-based, including
            drafts that haven&apos;t finished. Escalate failed runs to your manager, service
            team, or as a Trackunit event.
          </p>
        </div>
        {isOwner && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link
              href="/inspections/test"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Test against a machine
            </Link>
            <Link
              href="/inspections"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              Build &amp; manage templates
            </Link>
          </div>
        )}
      </div>

      <InspectionHistoryList runs={runs} />
    </div>
  );
}
