import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionContext } from '@/lib/getSessionContext';
import { listFleetsForAccount } from '@/lib/fleets';
import { listInvites } from '@/lib/invites';
import { listMembers } from '@/lib/members';
import { MembersTable } from './MembersTable';
import { InvitesTable } from './InvitesTable';
import { InviteButton } from './InviteButton';

export const dynamic = 'force-dynamic';

export default async function UsersSettingsPage() {
  const ctx = await getSessionContext();
  if (ctx.role === 'operator') redirect('/settings');
  const isOwner = ctx.role === 'account_admin';

  const [members, invites, fleets] = await Promise.all([
    listMembers(ctx.accountId),
    listInvites(ctx.accountId),
    listFleetsForAccount(ctx.accountId),
  ]);

  // Admins can only grant fleets they themselves can access; owners are unrestricted.
  const inviteableFleets = isOwner
    ? fleets
    : fleets.filter((f) => (ctx.allowedFleetIds ?? []).includes(f.id));

  const fleetsById = Object.fromEntries(fleets.map((f) => [f.id, f.name]));

  return (
    <div className="max-w-5xl">
      <div className="flex items-start justify-between gap-4 mb-2">
        <div>
          <div className="text-sm">
            <Link
              href="/settings"
              className="text-slate-500 hover:text-slate-900 inline-flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Settings
            </Link>
          </div>
          <h1 className="mt-2 text-xl font-bold text-slate-900">Users</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Invite admins and operators to this account and pick which fleets they can
            access.{' '}
            {isOwner
              ? 'Only account owners can edit or remove existing members.'
              : 'As an admin you can invite, but only into fleets you have access to. Owners manage existing members.'}
          </p>
        </div>
        <InviteButton fleets={inviteableFleets} canInviteAdmins={isOwner} />
      </div>

      <div className="mt-6 space-y-6">
        <section>
          <h2 className="text-sm font-semibold text-slate-700 mb-2">
            Members ({members.length})
          </h2>
          <MembersTable
            members={members}
            currentUserId={ctx.userId}
            fleets={fleets}
            fleetsById={fleetsById}
            isOwner={isOwner}
          />
        </section>

        <section>
          <h2 className="text-sm font-semibold text-slate-700 mb-2">
            Pending invites ({invites.length})
          </h2>
          <InvitesTable invites={invites} fleetsById={fleetsById} />
        </section>
      </div>
    </div>
  );
}
