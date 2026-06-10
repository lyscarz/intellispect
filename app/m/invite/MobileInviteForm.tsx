'use client';

import { useEffect, useState, useTransition } from 'react';
import QRCode from 'qrcode';
import { createInviteAction, type CreateInviteResult } from '@/app/(app)/settings/users/actions';
import type { Fleet } from '@/lib/types';

type Role = 'admin_user' | 'operator';

export function MobileInviteForm({
  fleets,
  canInviteAdmins,
}: {
  fleets: Fleet[];
  canInviteAdmins: boolean;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>(canInviteAdmins ? 'admin_user' : 'operator');
  const [selectedFleetIds, setSelectedFleetIds] = useState<string[]>(fleets.map((f) => f.id));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateInviteResult | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!result?.magicLink) {
      setQrDataUrl(null);
      return;
    }
    QRCode.toDataURL(result.magicLink, {
      margin: 1,
      width: 360,
      errorCorrectionLevel: 'M',
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [result?.magicLink]);

  function toggleFleet(id: string) {
    setSelectedFleetIds((cur) =>
      cur.includes(id) ? cur.filter((f) => f !== id) : [...cur, id]
    );
  }

  function submit() {
    setError(null);
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    startTransition(async () => {
      try {
        const res = await createInviteAction({
          email: email.trim(),
          role,
          allowedFleetIds: selectedFleetIds,
        });
        setResult(res);
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  async function copyLink() {
    if (!result?.magicLink) return;
    await navigator.clipboard.writeText(result.magicLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function reset() {
    setResult(null);
    setQrDataUrl(null);
    setEmail('');
  }

  if (result) {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl bg-white border border-slate-200 p-4 text-center">
          <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-2">
            Have them scan this
          </div>
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrDataUrl}
              alt="Invite QR code"
              className="w-full max-w-xs aspect-square mx-auto rounded border border-slate-200"
            />
          ) : (
            <div className="w-full max-w-xs aspect-square mx-auto rounded border border-slate-200 bg-slate-50 flex items-center justify-center text-xs text-slate-400">
              Generating QR…
            </div>
          )}
          <div className="mt-3 text-sm text-slate-700 font-medium">{email}</div>
          <div className="text-[11px] text-slate-400">
            {role === 'admin_user' ? 'Admin' : 'Operator'} ·{' '}
            {selectedFleetIds.length} fleet{selectedFleetIds.length === 1 ? '' : 's'}
          </div>
        </div>

        {result.emailDeliveryError && (
          <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
            Email delivery failed ({result.emailDeliveryError}). Use the QR / link below.
          </div>
        )}

        <div className="rounded-2xl bg-white border border-slate-200 p-3">
          <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold mb-1">
            Or share the link
          </div>
          <input
            type="text"
            readOnly
            value={result.magicLink}
            className="w-full px-2 py-1.5 text-xs rounded-md border border-slate-300 bg-slate-50 font-mono"
            onClick={(e) => (e.currentTarget as HTMLInputElement).select()}
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={copyLink}
              className="flex-1 px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold"
            >
              {copied ? 'Copied' : 'Copy link'}
            </button>
            <button
              type="button"
              onClick={reset}
              className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-sm font-medium text-slate-700"
            >
              New invite
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="block text-xs font-medium text-slate-600 mb-1">Email</span>
        <input
          type="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="teammate@example.com"
          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none"
        />
      </label>

      <div>
        <div className="block text-xs font-medium text-slate-600 mb-1">Role</div>
        <div className={`grid gap-1.5 ${canInviteAdmins ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {canInviteAdmins && (
            <RoleOption
              selected={role === 'admin_user'}
              onClick={() => setRole('admin_user')}
              label="Admin"
              body="Full access on granted fleets. Can invite operators."
            />
          )}
          <RoleOption
            selected={role === 'operator'}
            onClick={() => setRole('operator')}
            label="Operator"
            body="Runs inspections on granted fleets."
          />
        </div>
      </div>

      <div>
        <div className="block text-xs font-medium text-slate-600 mb-1">Fleets</div>
        {fleets.length === 0 ? (
          <p className="text-xs text-slate-500">No fleets to grant.</p>
        ) : (
          <div className="grid gap-1.5 max-h-44 overflow-y-auto rounded-lg border border-slate-200 p-2 bg-white">
            {fleets.map((f) => (
              <label key={f.id} className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedFleetIds.includes(f.id)}
                  onChange={() => toggleFleet(f.id)}
                />
                {f.name}
              </label>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={pending || !email.trim() || fleets.length === 0}
        className="w-full px-3 py-3 rounded-xl bg-brand-600 text-white text-sm font-semibold disabled:opacity-50"
      >
        {pending ? 'Generating…' : 'Generate QR invite'}
      </button>
    </div>
  );
}

function RoleOption({
  selected,
  onClick,
  label,
  body,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  body: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-lg border p-2 ${
        selected
          ? 'border-brand-500 ring-2 ring-brand-200 bg-white'
          : 'border-slate-200 bg-white'
      }`}
    >
      <div className="text-xs font-semibold text-slate-800">{label}</div>
      <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">{body}</div>
    </button>
  );
}
