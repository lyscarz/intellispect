import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionContext } from '@/lib/getSessionContext';
import { listFleetsForAccount } from '@/lib/fleets';
import { MobileInviteForm } from './MobileInviteForm';

export const dynamic = 'force-dynamic';

export default async function MobileInvitePage() {
  const ctx = await getSessionContext();
  // Only owners + admins can invite. Operators bounce back to /m.
  if (ctx.role === 'operator') redirect('/m');

  const isOwner = ctx.role === 'account_admin';
  const fleets = await listFleetsForAccount(ctx.accountId);
  const inviteableFleets = isOwner
    ? fleets
    : fleets.filter((f) => (ctx.allowedFleetIds ?? []).includes(f.id));

  return (
    <div className="px-4 py-3 max-w-screen-sm mx-auto">
      <Link href="/m" className="inline-flex items-center gap-1 text-sm text-slate-500 mb-3">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        My fleet
      </Link>

      <header className="mb-4">
        <h1 className="text-xl font-bold">Invite teammate</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          {isOwner
            ? 'Generate a QR code for an admin or operator. Scan with their phone to join.'
            : 'Generate a QR code for an operator. They join with access to the fleets you pick.'}
        </p>
      </header>

      <MobileInviteForm fleets={inviteableFleets} canInviteAdmins={isOwner} />
    </div>
  );
}
