'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const ROLE_LABEL: Record<string, string> = {
  account_admin: 'Owner',
  admin_user: 'Admin',
  operator: 'Operator',
};
const ROLE_CHIP: Record<string, string> = {
  account_admin: 'bg-amber-100 text-amber-800',
  admin_user: 'bg-sky-100 text-sky-700',
  operator: 'bg-slate-100 text-slate-600',
};

interface Membership {
  accountId: string;
  accountName: string;
  role: 'account_admin' | 'admin_user' | 'operator';
}

export function AccountSwitcher({
  activeAccountId,
  activeAccountName,
  memberships,
}: {
  activeAccountId: string;
  activeAccountName: string;
  memberships: Membership[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function switchTo(accountId: string) {
    if (accountId === activeAccountId) {
      setOpen(false);
      return;
    }
    startTransition(async () => {
      const res = await fetch('/api/account/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });
      if (!res.ok) return;
      setOpen(false);
      router.push('/fleet');
      router.refresh();
    });
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 max-w-[14rem] hover:bg-slate-200"
        aria-haspopup="listbox"
        aria-expanded={open}
        title={activeAccountName}
      >
        <svg
          className="w-3.5 h-3.5 text-slate-400 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2m-2 0v-5m-9 5v-5a1 1 0 011-1h2a1 1 0 011 1v5"
          />
        </svg>
        <span className="truncate">{activeAccountName}</span>
        <svg
          className={`w-3 h-3 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-1.5 w-64 z-50 rounded-lg border border-slate-200 bg-white shadow-lg overflow-hidden">
          <ul className="max-h-72 overflow-y-auto">
            {memberships.map((m) => {
              const isActive = m.accountId === activeAccountId;
              return (
                <li key={m.accountId}>
                  <button
                    type="button"
                    onClick={() => switchTo(m.accountId)}
                    disabled={pending}
                    className={`w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 ${
                      isActive ? 'bg-amber-50/50' : ''
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-900 truncate text-sm">
                        {m.accountName}
                      </div>
                      <span
                        className={`mt-0.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${
                          ROLE_CHIP[m.role] ?? 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {ROLE_LABEL[m.role] ?? m.role}
                      </span>
                    </div>
                    {isActive && (
                      <svg
                        className="w-4 h-4 text-emerald-600 flex-shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-slate-100">
            <Link
              href="/settings/accounts"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-xs font-medium text-brand-700 hover:bg-slate-50"
            >
              + Create new account
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
