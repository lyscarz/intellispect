'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { removeGqlAction } from './actions';

export function RemoveGqlButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (
      !window.confirm(
        "Remove GraphQL credentials? V1 (REST + AEMP) keeps working but V2 features (per-asset location, images) won't be available."
      )
    )
      return;
    startTransition(async () => {
      const form = new FormData();
      await removeGqlAction(form);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="text-sm text-slate-500 hover:text-red-700 disabled:opacity-50 px-2 py-1"
    >
      {pending ? 'Removing…' : 'Remove'}
    </button>
  );
}
