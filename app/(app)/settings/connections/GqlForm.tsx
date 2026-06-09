'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { updateGqlAction } from './actions';

interface Props {
  /** Whether V2 credentials are already saved. Controls the form's mode. */
  hasGql: boolean;
}

export function GqlForm({ hasGql }: Props) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-3 py-2"
      >
        {hasGql ? 'Replace GraphQL credentials' : 'Add GraphQL credentials'}
      </button>
    );
  }

  return (
    <form action={updateGqlAction} className="space-y-3 rounded-lg ring-1 ring-slate-200 bg-slate-50 p-4">
      <div>
        <label className="block text-xs font-medium text-slate-700">Client ID</label>
        <input
          name="gql_client_id"
          required
          placeholder="From Trackunit Manager → Administration → API Keys"
          className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700">Client secret</label>
        <input
          type="password"
          name="gql_client_secret"
          required
          autoComplete="off"
          className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
        />
      </div>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-slate-600 hover:text-slate-900 px-2 py-1"
        >
          Cancel
        </button>
        <SaveButton />
      </div>
      <p className="text-xs text-slate-500">
        We verify these against Trackunit before saving. If verification fails the existing
        credentials stay untouched.
      </p>
    </form>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium px-3 py-1.5"
    >
      {pending ? 'Verifying & saving…' : 'Save GraphQL credentials'}
    </button>
  );
}
