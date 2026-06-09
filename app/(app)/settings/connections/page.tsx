import Link from 'next/link';
import { getSessionContext } from '@/lib/getSessionContext';
import { getConnectionInfo } from '@/lib/telematics/connections';
import { ConnectionForm } from './ConnectionForm';
import { GqlForm } from './GqlForm';
import { RemoveGqlButton } from './RemoveGqlButton';
import { disconnectTrackunitAction, saveTrackunitAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: {
    error?: string;
    saved?: string;
    disconnected?: string;
    gqlSaved?: string;
    gqlRemoved?: string;
  };
}) {
  const ctx = await getSessionContext();
  const info = await getConnectionInfo(ctx.accountId, 'trackunit');
  const connection = info?.connection ?? null;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 mb-6 text-sm text-slate-500">
        <Link href="/settings" className="hover:text-slate-700">Settings</Link>
        <span>/</span>
        <span className="text-slate-900">Connections</span>
      </div>

      <h1 className="text-xl font-bold text-slate-900">Telematics connections</h1>
      <p className="text-sm text-slate-500 mt-0.5">
        Connect a telematics provider to import live machines into your fleet.
      </p>

      {searchParams.saved && (
        <div className="mt-6 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-800">
          Connection saved. You can now <Link href="/fleet/connect" className="underline font-medium">connect Trackunit machines</Link>.
        </div>
      )}
      {searchParams.gqlSaved && (
        <div className="mt-6 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-800">
          GraphQL credentials saved. Per-asset location and images now use V2.
        </div>
      )}
      {searchParams.gqlRemoved && (
        <div className="mt-6 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-700">
          GraphQL credentials removed. V1 (REST + AEMP) is still active.
        </div>
      )}
      {searchParams.disconnected && (
        <div className="mt-6 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-700">
          Disconnected. Existing connected machines stay in your fleet with their last snapshot.
        </div>
      )}
      {searchParams.error && (
        <div className="mt-6 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {searchParams.error}
        </div>
      )}

      <div className="mt-8 space-y-6">
        <div className="rounded-xl ring-1 ring-slate-200 bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-slate-900">Trackunit</h3>
              {connection ? (
                <p className="text-sm text-slate-500 mt-1">
                  Connected{connection.label ? ` as "${connection.label}"` : ''}. Last verified{' '}
                  {connection.lastVerifiedAt
                    ? new Date(connection.lastVerifiedAt).toUTCString()
                    : 'never'}
                  .
                </p>
              ) : (
                <p className="text-sm text-slate-500 mt-1">Not connected.</p>
              )}
            </div>
            {connection && (
              <form action={disconnectTrackunitAction}>
                <button
                  type="submit"
                  className="rounded-lg ring-1 ring-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-sm font-medium px-3 py-2"
                >
                  Disconnect
                </button>
              </form>
            )}
          </div>

          {connection && (
            <div className="mt-6 border-t border-slate-100 pt-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">GraphQL (V2) credentials</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Unlocks per-asset location for assets not in the AEMP feed, plus images and
                    richer telematics. Get an API Key from{' '}
                    <a
                      href="https://manager.trackunit.com"
                      target="_blank"
                      rel="noreferrer"
                      className="text-brand-600 hover:text-brand-700 underline"
                    >
                      Trackunit Manager → Administration → API Keys
                    </a>
                    .
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    info?.hasGql
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      info?.hasGql ? 'bg-emerald-500' : 'bg-slate-400'
                    }`}
                  />
                  {info?.hasGql ? 'Configured' : 'Not set'}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <GqlForm hasGql={!!info?.hasGql} />
                {info?.hasGql && <RemoveGqlButton />}
              </div>
            </div>
          )}
        </div>

        {!connection && (
          <>
            <h2 className="text-base font-semibold text-slate-900 mt-2">Connect Trackunit</h2>
            <p className="text-sm text-slate-500 -mt-3">
              From{' '}
              <a
                href="https://manager.trackunit.com"
                target="_blank"
                rel="noreferrer"
                className="text-brand-600 hover:text-brand-700 underline"
              >
                Trackunit Manager
              </a>
              {' '}→ Administration → API Keys.
            </p>
            <ConnectionForm saveAction={saveTrackunitAction} />
          </>
        )}
      </div>
    </div>
  );
}
