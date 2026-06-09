import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSessionContext } from '@/lib/getSessionContext';
import { getMachine } from '@/lib/machines';
import { getSignedImageUrl } from '@/lib/storage';
import { listFleetsForAccount } from '@/lib/fleets';
import { listSitesForAccount } from '@/lib/sites';
import { MachineHomeLive } from '@/components/MachineHomeLive';
import { FleetSitePicker } from '@/components/FleetSitePicker';
import { AlertsBadge } from '@/components/AlertsBadge';
import type { Site } from '@/lib/types';
import { disconnectOrDeleteAction, updateMachineAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function MachineHomePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string };
}) {
  const ctx = await getSessionContext();
  const machine = await getMachine(params.id, ctx.accountId);
  if (!machine) notFound();

  const [uploadedImageUrl, fleets, sites] = await Promise.all([
    getSignedImageUrl(machine.imagePath),
    listFleetsForAccount(ctx.accountId),
    listSitesForAccount(ctx.accountId),
  ]);
  // Prefer user-uploaded image; fall back to Trackunit-provided one from the snapshot.
  const imageUrl = uploadedImageUrl ?? machine.lastSnapshot?.imageUrl ?? null;
  const sitesByFleetId: Record<string, Site[]> = {};
  for (const s of sites) {
    (sitesByFleetId[s.fleetId] ??= []).push(s);
  }
  const isTrackunit = machine.source === 'trackunit';
  const isDisconnected = machine.status === 'disconnected';
  const liveRefresh = isTrackunit && !isDisconnected;

  const update = updateMachineAction.bind(null, machine.id);
  const remove = disconnectOrDeleteAction.bind(null, machine.id);

  return (
    <div className="max-w-4xl space-y-8">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/fleet" className="hover:text-slate-700">Fleet</Link>
        <span>/</span>
        <span className="text-slate-900">{machine.name}</span>
      </div>

      {/* Header — image alongside title block */}
      <div className="flex items-start gap-5">
        {imageUrl ? (
          <div className="flex-shrink-0 rounded-xl overflow-hidden ring-1 ring-slate-200 bg-slate-100 w-32 h-32 sm:w-40 sm:h-40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt={machine.name} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="flex-shrink-0 rounded-xl ring-1 ring-slate-200 bg-slate-50 w-32 h-32 sm:w-40 sm:h-40 flex items-center justify-center">
            <svg className="w-10 h-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900 truncate">{machine.name}</h1>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide
                ${isTrackunit ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-600'}`}
            >
              {isTrackunit ? 'Trackunit' : 'Manual'}
            </span>
            {machine.lastSnapshot?.assetType && machine.lastSnapshot.assetType !== 'MACHINE' && (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                {machine.lastSnapshot.assetType}
              </span>
            )}
            {isDisconnected && (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                Disconnected
              </span>
            )}
            {/* Trackunit criticality rollup. Reads the server-rendered snapshot — */}
            {/* the live-refreshed copy inside MachineHomeLive renders its own panel. */}
            <AlertsBadge attention={machine.lastSnapshot?.attention ?? null} size="lg" />
          </div>
          {(machine.brand || machine.model) && (
            <p className="mt-1 text-sm text-slate-500">
              {[machine.brand, machine.model].filter(Boolean).join(' · ')}
            </p>
          )}
          {machine.serialNumber && (
            <p className="mt-0.5 text-xs text-slate-400 font-mono">SN {machine.serialNumber}</p>
          )}
        </div>
      </div>

      {searchParams.error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {searchParams.error}
        </div>
      )}

      {/* Live section: map + telematics tiles + 30s auto-refresh for active Trackunit */}
      <MachineHomeLive
        machineId={machine.id}
        name={machine.name}
        initialSnapshot={machine.lastSnapshot}
        initialSyncedAt={machine.lastSyncedAt}
        liveRefresh={liveRefresh}
      />

      {/* Edit form */}
      <section>
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">Details</h2>
        <form action={update} className="space-y-4 bg-white rounded-xl ring-1 ring-slate-200 p-6">
          <Field name="name" label="Name" defaultValue={machine.name} required />
          <div className="grid grid-cols-2 gap-4">
            <Field name="brand" label="Brand" defaultValue={machine.brand ?? ''} />
            <Field name="model" label="Model" defaultValue={machine.model ?? ''} />
          </div>
          <Field name="serial_number" label="Serial number" defaultValue={machine.serialNumber ?? ''} />

          <FleetSitePicker
            fleets={fleets}
            sitesByFleetId={sitesByFleetId}
            defaultFleetId={machine.fleetId}
            defaultSiteId={machine.siteId}
          />
          <p className="text-xs text-slate-400 -mt-2">
            Changing fleet will clear the site assignment.
          </p>

          <Field name="site" label="Site label (free-form, legacy)" defaultValue={machine.site ?? ''} />

          <div>
            <label className="block text-sm font-medium text-slate-700">Replace image</label>
            <input
              type="file"
              name="image"
              accept="image/*"
              className="mt-1 block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:py-1.5 file:px-3 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
            />
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
              Save changes
            </button>
          </div>
        </form>
      </section>

      {/* Danger zone */}
      <section>
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-3">Danger zone</h2>
        <form
          action={remove}
          className="rounded-xl ring-1 ring-red-200 bg-red-50 p-4 flex items-center justify-between"
        >
          <div>
            <h3 className="text-sm font-semibold text-red-900">
              {isTrackunit && !isDisconnected ? 'Disconnect from Trackunit' : 'Remove permanently'}
            </h3>
            <p className="text-xs text-red-700 mt-0.5">
              {isTrackunit && !isDisconnected
                ? 'Stops syncing from Trackunit. Last snapshot stays on this card.'
                : isTrackunit
                  ? 'Permanently delete this machine. The Trackunit asset is unaffected.'
                  : 'Permanently delete this manual machine and its image.'}
            </p>
          </div>
          <button
            type="submit"
            className="rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-3 py-2"
          >
            {isTrackunit && !isDisconnected ? 'Disconnect' : 'Delete'}
          </button>
        </form>
      </section>
    </div>
  );
}

function Field({
  name,
  label,
  defaultValue,
  required,
}: {
  name: string;
  label: string;
  defaultValue?: string;
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
        required={required}
        className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
      />
    </div>
  );
}
