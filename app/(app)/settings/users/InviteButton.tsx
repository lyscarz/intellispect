'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createInviteAction, type CreateInviteResult } from './actions';
import type { Fleet } from '@/lib/types';

type Role = 'admin_user' | 'operator';

export function InviteButton({ fleets }: { fleets: Fleet[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Invite member
      </button>
      {open && <InviteModal fleets={fleets} onClose={() => setOpen(false)} />}
    </>
  );
}

function InviteModal({ fleets, onClose }: { fleets: Fleet[]; onClose: () => void }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('admin_user');
  const [selectedFleetIds, setSelectedFleetIds] = useState<string[]>(
    fleets.map((f) => f.id)
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateInviteResult | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

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
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  async function copyMagicLink() {
    if (!result?.magicLink) return;
    await navigator.clipboard.writeText(result.magicLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">
            {result ? 'Invite created' : 'Invite member'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {result ? (
          <div className="p-5 space-y-3">
            {result.emailDeliveryError ? (
              <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                Email delivery failed ({result.emailDeliveryError}). Share the link
                manually with the invitee — it will sign them in and accept the invite.
              </div>
            ) : (
              <div className="rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-800">
                Invite email sent. They can also use the link below if they don&apos;t see it.
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Invite link
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={result.magicLink}
                  className="flex-1 px-2 py-1.5 text-xs rounded-md border border-slate-300 bg-slate-50 font-mono"
                  onClick={(e) => (e.currentTarget as HTMLInputElement).select()}
                />
                <button
                  type="button"
                  onClick={copyMagicLink}
                  className="px-3 py-1.5 rounded-md bg-slate-900 text-white text-xs font-medium hover:bg-slate-800"
                >
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-md bg-brand-600 text-white text-sm font-medium hover:bg-brand-700"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-3">
            <Field
              label="Email"
              value={email}
              onChange={setEmail}
              placeholder="teammate@example.com"
              type="email"
            />

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Role</label>
              <div className="grid grid-cols-2 gap-1.5">
                <RoleOption
                  selected={role === 'admin_user'}
                  onClick={() => setRole('admin_user')}
                  label="Admin"
                  body="Full access on granted fleets. Cannot invite or manage other members."
                />
                <RoleOption
                  selected={role === 'operator'}
                  onClick={() => setRole('operator')}
                  label="Operator"
                  body="Mobile-app user who runs inspections on granted fleets."
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Fleets they can access
              </label>
              {fleets.length === 0 ? (
                <p className="text-xs text-slate-500">
                  No fleets in this account yet. Create one in Settings → Fleets first.
                </p>
              ) : (
                <div className="grid gap-1.5 max-h-44 overflow-y-auto rounded-md border border-slate-200 p-2">
                  {fleets.map((f) => (
                    <label
                      key={f.id}
                      className="inline-flex items-center gap-2 text-sm cursor-pointer"
                    >
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
              <p className="text-[11px] text-slate-400 mt-1">
                You can change this later from the members list.
              </p>
            </div>

            {error && (
              <div className="rounded-md bg-rose-50 border border-rose-200 px-3 py-1.5 text-xs text-rose-700">
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="text-sm text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={pending || !email.trim()}
                className="px-3 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
              >
                {pending ? 'Sending…' : 'Send invite'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-600 mb-1">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm rounded-md border border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none"
      />
    </label>
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
      className={`text-left rounded-md border p-2 transition ${
        selected
          ? 'border-brand-500 ring-2 ring-brand-200 bg-white'
          : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <div className="text-xs font-semibold text-slate-800">{label}</div>
      <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">{body}</div>
    </button>
  );
}
