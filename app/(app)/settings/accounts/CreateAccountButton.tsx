'use client';

import { useEffect, useState, useTransition } from 'react';
import { createAccountAction } from './actions';

export function CreateAccountButton() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function submit() {
    setError(null);
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    startTransition(async () => {
      try {
        await createAccountAction(name);
        // createAccountAction redirects; this line is unreachable on success.
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

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
        Create new account
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Create new account</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                You&apos;ll be added as Owner. A default fleet is created automatically. The
                active account switches immediately to the new one.
              </p>
            </div>
            <div className="p-5 space-y-3">
              <label className="block">
                <span className="block text-xs font-medium text-slate-600 mb-1">
                  Account name
                </span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Acme Construction"
                  autoFocus
                  className="w-full px-3 py-2 text-sm rounded-md border border-slate-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none"
                />
              </label>
              {error && (
                <div className="rounded-md bg-rose-50 border border-rose-200 px-3 py-1.5 text-xs text-rose-700">
                  {error}
                </div>
              )}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-sm text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={pending || !name.trim()}
                  className="px-3 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
                >
                  {pending ? 'Creating…' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
