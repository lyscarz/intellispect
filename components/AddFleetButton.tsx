'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createFleetAction } from '@/app/(app)/settings/fleets/actions';

export function AddFleetButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        const fleet = await createFleetAction(name.trim());
        setName('');
        setOpen(false);
        router.push(`/fleet?fleet=${encodeURIComponent(fleet.slug)}`);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create fleet');
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-2.5 text-sm font-medium text-slate-500 hover:text-brand-700"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add fleet
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-2 px-3 py-1.5"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          setOpen(false);
          setName('');
          setError(null);
        }
      }}
    >
      <input
        type="text"
        autoFocus
        placeholder="Fleet name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
      />
      <button
        type="submit"
        disabled={pending || !name.trim()}
        className="rounded-md bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium px-2.5 py-1.5 disabled:opacity-50"
      >
        {pending ? 'Adding…' : 'Add'}
      </button>
      <button
        type="button"
        onClick={() => {
          setOpen(false);
          setName('');
          setError(null);
        }}
        className="text-xs text-slate-500 hover:text-slate-700"
      >
        Cancel
      </button>
      {error && <span className="text-xs text-red-600 ml-1">{error}</span>}
    </form>
  );
}
