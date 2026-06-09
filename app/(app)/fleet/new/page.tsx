import Link from 'next/link';
import { getSessionContext } from '@/lib/getSessionContext';
import { listFleetsForAccount } from '@/lib/fleets';
import { listSitesForAccount } from '@/lib/sites';
import { FleetSitePicker } from '@/components/FleetSitePicker';
import type { Site } from '@/lib/types';
import { createManualMachineAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function NewMachinePage({
  searchParams,
}: {
  searchParams: { error?: string; fleet?: string };
}) {
  const ctx = await getSessionContext();
  const [fleets, sites] = await Promise.all([
    listFleetsForAccount(ctx.accountId),
    listSitesForAccount(ctx.accountId),
  ]);

  const sitesByFleetId: Record<string, Site[]> = {};
  for (const s of sites) {
    (sitesByFleetId[s.fleetId] ??= []).push(s);
  }

  // Default fleet — match the active tab on /fleet if the user came from there.
  const requestedSlug = searchParams.fleet ?? null;
  const defaultFleet =
    fleets.find((f) => f.slug === requestedSlug) ?? fleets[0] ?? null;

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-2 mb-6 text-sm text-slate-500">
        <Link href="/fleet" className="hover:text-slate-700">Fleet</Link>
        <span>/</span>
        <span className="text-slate-900">Add machine</span>
      </div>

      <h1 className="text-xl font-bold text-slate-900">Add a machine</h1>
      <p className="text-sm text-slate-500 mt-0.5">
        Create a machine manually. To import from Trackunit, use{' '}
        <Link href="/fleet/connect" className="text-brand-600 hover:text-brand-700">Connect Trackunit</Link>.
      </p>

      {searchParams.error && (
        <div className="mt-6 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {searchParams.error}
        </div>
      )}

      <form action={createManualMachineAction} className="mt-6 space-y-4 bg-white rounded-xl ring-1 ring-slate-200 p-6">
        <Field name="name" label="Name" placeholder="Compressor 01" required />
        <div className="grid grid-cols-2 gap-4">
          <Field name="brand" label="Brand" placeholder="Atlas Copco" />
          <Field name="model" label="Model" placeholder="XAS 88" />
        </div>
        <Field name="serial_number" label="Serial number" placeholder="A1234567" />

        <FleetSitePicker
          fleets={fleets}
          sitesByFleetId={sitesByFleetId}
          defaultFleetId={defaultFleet?.id ?? null}
        />

        <div>
          <label className="block text-sm font-medium text-slate-700">Image</label>
          <input
            type="file"
            name="image"
            accept="image/*"
            className="mt-1 block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:py-1.5 file:px-3 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
          />
          <p className="mt-1 text-xs text-slate-400">Optional. JPG, PNG, WebP. Will show as a coloured placeholder if omitted.</p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Link
            href="/fleet"
            className="rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 px-3 py-2"
          >
            Cancel
          </Link>
          <button
            type="submit"
            className="rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2"
          >
            Create machine
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  name,
  label,
  placeholder,
  required,
}: {
  name: string;
  label: string;
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
        placeholder={placeholder}
        required={required}
        className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
      />
    </div>
  );
}
