import { getSessionContext } from '@/lib/getSessionContext';
import { listAllRuns } from '@/lib/inspections/runs';
import { InspectionHistoryList } from './InspectionHistoryList';

export const dynamic = 'force-dynamic';

export default async function InspectionHistoryPage() {
  const ctx = await getSessionContext();
  const runs = await listAllRuns(ctx.accountId, { limit: 100 });

  return (
    <div className="max-w-6xl">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Inspections</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Every inspection run on this account — both AI-driven and form-based, including
          drafts that haven&apos;t finished. Escalate failed runs to your manager, service
          team, or as a Trackunit event.
        </p>
      </div>

      <InspectionHistoryList runs={runs} />
    </div>
  );
}
