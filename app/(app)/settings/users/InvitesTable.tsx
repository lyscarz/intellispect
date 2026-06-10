'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { revokeInviteAction } from './actions';
import type { AccountInvite } from '@/lib/invites';

const ROLE_LABEL: Record<string, string> = {
  account_admin: 'Owner',
  admin_user: 'Admin',
  operator: 'Operator',
};

export function InvitesTable({
  invites,
  fleetsById,
}: {
  invites: AccountInvite[];
  fleetsById: Record<string, string>;
}) {
  if (invites.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
        No pending invites.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
          <tr>
            <th className="text-left font-semibold px-3 py-2">Email</th>
            <th className="text-left font-semibold px-3 py-2">Role</th>
            <th className="text-left font-semibold px-3 py-2">Fleet access</th>
            <th className="text-left font-semibold px-3 py-2">Expires</th>
            <th className="text-right font-semibold px-3 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {invites.map((inv) => (
            <InviteRow key={inv.id} invite={inv} fleetsById={fleetsById} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InviteRow({
  invite,
  fleetsById,
}: {
  invite: AccountInvite;
  fleetsById: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const expiresIn = humanRelative(new Date(invite.expiresAt).getTime() - Date.now());
  const origin =
    typeof window !== 'undefined' ? window.location.origin : '';
  const magicLink = `${origin}/accept-invite?token=${invite.token}`;

  async function copy() {
    if (!magicLink) return;
    await navigator.clipboard.writeText(magicLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function revoke() {
    if (!confirm(`Revoke the invite for ${invite.email}?`)) return;
    setError(null);
    startTransition(async () => {
      try {
        await revokeInviteAction(invite.id);
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  return (
    <tr className="border-t border-slate-200">
      <td className="px-3 py-2 font-medium text-slate-800">{invite.email}</td>
      <td className="px-3 py-2">
        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-sky-100 text-[10px] font-semibold uppercase tracking-wide text-sky-700">
          {ROLE_LABEL[invite.role] ?? invite.role}
        </span>
      </td>
      <td className="px-3 py-2">
        {invite.role === 'account_admin' ? (
          <span className="text-xs text-slate-500">All fleets</span>
        ) : invite.allowedFleetIds.length === 0 ? (
          <span className="text-xs text-rose-600">No fleets</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {invite.allowedFleetIds.map((id) => (
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
      <td className="px-3 py-2 text-xs text-slate-500">{expiresIn}</td>
      <td className="px-3 py-2 text-right whitespace-nowrap">
        <button
          type="button"
          onClick={copy}
          className="text-xs font-medium text-brand-700 hover:text-brand-800 mr-3"
        >
          {copied ? 'Copied' : 'Copy link'}
        </button>
        <button
          type="button"
          onClick={revoke}
          disabled={pending}
          className="text-xs font-medium text-rose-600 hover:text-rose-700 disabled:opacity-50"
        >
          Revoke
        </button>
        {error && (
          <div className="text-[11px] text-rose-600 mt-1">{error}</div>
        )}
      </td>
    </tr>
  );
}

function humanRelative(ms: number): string {
  if (ms <= 0) return 'expired';
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days >= 1) return `in ${days}d`;
  const hours = Math.floor(ms / (60 * 60 * 1000));
  if (hours >= 1) return `in ${hours}h`;
  const minutes = Math.floor(ms / (60 * 1000));
  return `in ${Math.max(minutes, 1)}m`;
}
