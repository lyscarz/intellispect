'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

export function SwitchAccountButton({ accountId }: { accountId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function swap() {
    startTransition(async () => {
      const res = await fetch('/api/account/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });
      if (!res.ok) return;
      router.push('/fleet');
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={swap}
      disabled={pending}
      className="px-3 py-1.5 rounded-md bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 disabled:opacity-50"
    >
      {pending ? 'Switching…' : 'Switch to'}
    </button>
  );
}
