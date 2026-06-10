import { getSessionContext } from '@/lib/getSessionContext';
import { listMachinesForAccount } from '@/lib/machines';
import { listSitesForAccount } from '@/lib/sites';
import { CheckInTab } from './CheckInTab';

export const dynamic = 'force-dynamic';

export default async function MobileLanding() {
  // /m is the Check-in tab: a full-screen map of the nearest machines, with a
  // bottom sheet for the selected machine and a check-in / check-out flow.
  // The Fleet list moved to /m/fleet.
  const ctx = await getSessionContext();
  const [machines, sites] = await Promise.all([
    listMachinesForAccount(ctx.accountId, ctx.allowedFleetIds),
    listSitesForAccount(ctx.accountId, ctx.allowedFleetIds),
  ]);

  return <CheckInTab machines={machines} sites={sites} />;
}
