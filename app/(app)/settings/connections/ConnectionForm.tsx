'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { testTrackunitAction, type ConnectionFormState } from './actions';

const initialState: ConnectionFormState = { status: 'idle' };

export function ConnectionForm({ saveAction }: { saveAction: (formData: FormData) => void }) {
  const [testState, testFormAction] = useFormState(testTrackunitAction, initialState);

  return (
    <form className="space-y-4 bg-white rounded-xl ring-1 ring-slate-200 p-6">
      <Field name="label" label="Label (optional)" placeholder="Production account" />
      <Field name="token_url" label="Token URL" defaultValue="https://auth.trackunit.com/token" />
      <Field name="client_id" label="Client ID" required placeholder="From Trackunit Developer Portal" />
      <PasswordField name="client_secret" label="Client secret" required />
      <Field name="username" label="API username" required />
      <PasswordField name="password" label="API password" required />

      <details className="border border-slate-200 rounded-lg">
        <summary className="px-4 py-2 cursor-pointer text-sm font-medium text-slate-700">
          GraphQL credentials (optional — needed for images)
        </summary>
        <div className="border-t border-slate-200 p-4 space-y-3">
          <Field name="gql_client_id" label="GQL client ID" />
          <PasswordField name="gql_client_secret" label="GQL client secret" />
          <Field name="gql_scope" label="GQL scope" placeholder="asset.view" />
        </div>
      </details>

      {testState.status !== 'idle' && (
        <div
          className={`rounded-lg px-3 py-2 text-sm ${
            testState.status === 'ok'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}
        >
          {testState.message}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          type="submit"
          formAction={testFormAction}
          className="rounded-lg ring-1 ring-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium px-3 py-2"
        >
          <TestLabel />
        </button>
        <button
          type="submit"
          formAction={saveAction}
          className="rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2"
        >
          <SaveLabel />
        </button>
      </div>
    </form>
  );
}

function TestLabel() {
  const { pending } = useFormStatus();
  return <>{pending ? 'Testing…' : 'Test connection'}</>;
}

function SaveLabel() {
  const { pending } = useFormStatus();
  return <>{pending ? 'Saving…' : 'Save & connect'}</>;
}

function Field({
  name,
  label,
  defaultValue,
  placeholder,
  required,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type="text"
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
      />
    </div>
  );
}

function PasswordField({
  name,
  label,
  required,
}: {
  name: string;
  label: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type="password"
        name={name}
        required={required}
        autoComplete="off"
        className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
      />
    </div>
  );
}
