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
  if (ctx.role !== 'account_admin') redirect('/settings');

  const [members, invites, fleets] = await Promise.all([
    listMembers(ctx.accountId),
    listInvites(ctx.accountId),
    listFleetsForAccount(ctx.accountId),
  ]);

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
            Invite admins and operators to this account and pick which fleets they can access.
            Only account owners can manage members.
          </p>
        </div>
        <InviteButton fleets={fleets} />
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
