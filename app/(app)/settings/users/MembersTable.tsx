'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  grantFleetAction,
  removeMemberAction,
  revokeFleetAction,
  updateMemberRoleAction,
} from './actions';
import type { AccountMember } from '@/lib/members';
import type { AccountRole, Fleet } from '@/lib/types';

const ROLE_LABEL: Record<AccountRole, string> = {
  account_admin: 'Owner',
  admin_user: 'Admin',
  operator: 'Operator',
};
const ROLE_CHIP: Record<AccountRole, string> = {
  account_admin: 'bg-amber-100 text-amber-800',
  admin_user: 'bg-sky-100 text-sky-700',
  operator: 'bg-slate-100 text-slate-600',
};

export function MembersTable({
  members,
  currentUserId,
  fleets,
  fleetsById,
  isOwner,
}: {
  members: AccountMember[];
  currentUserId: string;
  fleets: Fleet[];
  fleetsById: Record<string, string>;
  /** Only owners can edit roles / fleet grants / remove members. */
  isOwner: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
          <tr>
            <th className="text-left font-semibold px-3 py-2">Email</th>
            <th className="text-left font-semibold px-3 py-2">Role</th>
            <th className="text-left font-semibold px-3 py-2">Fleet access</th>
            <th className="text-right font-semibold px-3 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <MemberRow
              key={m.userId}
              member={m}
              isSelf={m.userId === currentUserId}
              fleets={fleets}
              fleetsById={fleetsById}
              canManage={isOwner}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MemberRow({
  member,
  isSelf,
  fleets,
  fleetsById,
  canManage,
}: {
  member: AccountMember;
  isSelf: boolean;
  fleets: Fleet[];
  fleetsById: Record<string, string>;
  canManage: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isOwnerRow = member.role === 'account_admin';

  function action<T extends unknown[]>(
    fn: (...args: T) => Promise<unknown>,
    ...args: T
  ) {
    setError(null);
    startTransition(async () => {
      try {
        await fn(...args);
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  function changeRole(role: AccountRole) {
    action(updateMemberRoleAction, member.userId, role);
  }
  function remove() {
    if (!confirm(`Remove ${member.email} from this account?`)) return;
    action(removeMemberAction, member.userId);
  }
  function toggleFleet(fleetId: string, granted: boolean) {
    if (granted) action(revokeFleetAction, member.userId, fleetId);
    else action(grantFleetAction, member.userId, fleetId);
  }

  return (
    <>
      <tr className="border-t border-slate-200">
        <td className="px-3 py-2 align-middle">
          <span className="font-medium text-slate-800">{member.email}</span>
          {isSelf && (
            <span className="ml-1.5 text-[10px] uppercase tracking-wide text-slate-400">
              (you)
            </span>
          )}
        </td>
        <td className="px-3 py-2 align-middle">
          <span
            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${ROLE_CHIP[member.role]}`}
          >
            {ROLE_LABEL[member.role]}
          </span>
        </td>
        <td className="px-3 py-2 align-middle">
          {member.fleetIds === null ? (
            <span className="text-xs text-slate-500">All fleets</span>
          ) : member.fleetIds.length === 0 ? (
            <span className="text-xs text-rose-600">No fleets granted</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {member.fleetIds.map((id) => (
                <span
                  key={id}
                  className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 text-[10px] text-slate-700"
                >
                  {fleetsById[id] ?? '(deleted fleet)'}
                </span>
              ))}
            </div>
          )}
        </td>
        <td className="px-3 py-2 align-middle text-right whitespace-nowrap">
          {!isOwnerRow && canManage && (
            <button
              type="button"
              onClick={() => setEditing((e) => !e)}
              className="text-xs font-medium text-brand-700 hover:text-brand-800 mr-3"
            >
              {editing ? 'Done' : 'Edit'}
            </button>
          )}
          {!isOwnerRow && canManage && (
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="text-xs font-medium text-rose-600 hover:text-rose-700 disabled:opacity-50"
            >
              Remove
            </button>
          )}
          {isOwnerRow && (
            <span className="text-[11px] text-slate-400">Owner</span>
          )}
          {!isOwnerRow && !canManage && (
            <span className="text-[11px] text-slate-400">Owner-only</span>
          )}
        </td>
      </tr>
      {editing && !isOwnerRow && canManage && (
        <tr className="border-t border-slate-100 bg-slate-50">
          <td colSpan={4} className="px-3 py-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-1">
                  Role
                </div>
                <div className="flex gap-1.5">
                  {(['admin_user', 'operator'] as AccountRole[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => changeRole(r)}
                      disabled={pending}
                      className={`px-2 py-1 rounded-md text-xs font-medium border ${
                        member.role === r
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {ROLE_LABEL[r]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold mb-1">
                  Fleet access
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {fleets.map((f) => {
                    const granted = (member.fleetIds ?? []).includes(f.id);
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => toggleFleet(f.id, granted)}
                        disabled={pending}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                          granted
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                            : 'bg-white border-slate-300 text-slate-500 hover:bg-slate-100'
                        }`}
                      >
                        {granted ? '✓ ' : '+ '}
                        {f.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            {error && (
              <div className="mt-2 rounded-md bg-rose-50 border border-rose-200 px-3 py-1.5 text-xs text-rose-700">
                {error}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
