'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Asset } from '@/lib/types';
import {
  batteryBarColor,
  formatHours,
  formatLastSeen,
  formatPercent,
  fuelBarColor,
  powerSourceFor,
  prettifyEventType,
} from '@/lib/format';
import type { AssetEvent } from '@/lib/types';
import { TelematicsMetric, Icons } from './TelematicsMetric';
import { MachineHomeMap } from './MachineHomeMap';
import { StatusBadge } from './StatusBadge';

/**
 * One-shot refresh on mount + manual "Refresh now" button.
 * Background freshness comes from the cron job (see /api/cron/refresh-aemp);
 * sitting on this page does NOT poll Trackunit.
 */
const ON_MOUNT_REFRESH_MAX_AGE_MS = 5 * 60_000; // skip mount-refresh if synced < 5 min ago

interface Props {
  machineId: string;
  name: string;
  initialSnapshot: Asset | null;
  initialSyncedAt: string | null;
  /** Only true for active Trackunit machines. */
  liveRefresh: boolean;
}

function syncedAgo(iso: string | null): string {
  if (!iso) return 'never';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'just now';
  const min = Math.round(ms / 60_000);
  if (min < 60) return `${min} min ago`;
  const hrs = Math.round(min / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.round(hrs / 24)} d ago`;
}

export function MachineHomeLive({
  machineId,
  name,
  initialSnapshot,
  initialSyncedAt,
  liveRefresh,
}: Props) {
  const [snapshot, setSnapshot] = useState<Asset | null>(initialSnapshot);
  const [syncedAt, setSyncedAt] = useState<string | null>(initialSyncedAt);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const didMountRefreshRef = useRef(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch(`/api/machines/${machineId}/refresh`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Refresh failed');
      } else if (json.snapshot) {
        setSnapshot(json.snapshot as Asset);
        setSyncedAt(json.syncedAt as string);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  }, [machineId]);

  // Single refresh on mount — but only if the existing snapshot is stale,
  // to avoid burning a Trackunit call when the cron just ran.
  useEffect(() => {
    if (!liveRefresh || didMountRefreshRef.current) return;
    didMountRefreshRef.current = true;
    const lastMs = initialSyncedAt ? new Date(initialSyncedAt).getTime() : 0;
    if (Date.now() - lastMs > ON_MOUNT_REFRESH_MAX_AGE_MS) {
      refresh();
    }
  }, [liveRefresh, initialSyncedAt, refresh]);

  const coords = snapshot?.location?.coordinates ?? null;
  const address = snapshot?.location?.address ?? null;
  const cityCountry = address
    ? [address.city, address.country].filter(Boolean).join(', ') || null
    : null;
  const fullAddress = address
    ? [address.street, address.city, address.country].filter(Boolean).join(', ') || null
    : null;

  const hasSnapshot = !!snapshot;
  const noCoordsHint =
    liveRefresh && hasSnapshot && !coords && !error
      ? 'Snapshot received, but Trackunit did not report coordinates in the latest update.'
      : null;

  return (
    <div className="space-y-4">
      <MachineHomeMap coords={coords} label={name} address={cityCountry} />

      {noCoordsHint && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
          {noCoordsHint}
        </div>
      )}

      {fullAddress && (
        <div className="text-xs text-slate-500 flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>{fullAddress}</span>
          {snapshot?.location?.updatedAt && (
            <span className="text-slate-400 ml-2">
              · updated {formatLastSeen(snapshot.location.updatedAt)}
            </span>
          )}
        </div>
      )}

      <div className="rounded-xl ring-1 ring-slate-200 bg-white p-5">
        {(() => {
          const fuel = snapshot?.insights.fuelLevel ?? null;
          const battery = snapshot?.insights.batteryStateOfChargePercent ?? null;
          const source = powerSourceFor({
            model: snapshot?.model ?? null,
            assetType: snapshot?.assetType ?? null,
            fuelLevel: fuel,
            batteryStateOfChargePercent: battery,
          });
          const showBattery = source === 'electric' || (source === 'unknown' && battery != null);
          return (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
              <div className="flex items-center justify-center">
                <StatusBadge activity={snapshot?.activity ?? null} />
              </div>
              {showBattery ? (
                <TelematicsMetric
                  icon={Icons.battery}
                  label="Battery"
                  value={formatPercent(battery)}
                  percent={battery}
                  barColor={batteryBarColor(battery)}
                />
              ) : (
                <TelematicsMetric
                  icon={Icons.fuel}
                  label="Fuel"
                  value={formatPercent(fuel)}
                  percent={fuel}
                  barColor={fuelBarColor(fuel)}
                />
              )}
              <TelematicsMetric
                icon={Icons.clock}
                label="Op. Hours"
                value={formatHours(snapshot?.insights.cumulativeOperatingHours ?? null)}
              />
              <TelematicsMetric
                icon={Icons.wrench}
                label="Last seen"
                value={formatLastSeen(snapshot?.lastSeen ?? null)}
              />
            </div>
          );
        })()}

        {liveRefresh && (
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span
                className={`w-2 h-2 rounded-full ${
                  refreshing ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'
                }`}
              />
              <span>Last synced {syncedAgo(syncedAt)}</span>
            </div>
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-lg ring-1 ring-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 text-xs font-medium px-2.5 py-1.5"
            >
              <svg
                className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {refreshing ? 'Refreshing…' : 'Refresh now'}
            </button>
          </div>
        )}

        {error && (
          <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}
      </div>

      <AttentionPanel
        attention={snapshot?.attention ?? null}
        events={snapshot?.events ?? []}
      />
    </div>
  );
}

/**
 * Live "Active alerts" panel — visible only when Trackunit reports a non-NONE
 * criticality. Renders the criticality headline + count breakdown, then the
 * actual event rows (type, severity pill, description, opened-at) beneath.
 *
 * Events come from `Asset.events.active` (already filtered server-side to
 * open/active only). We sort by `openedAt` desc client-side so the newest
 * floats to the top.
 */
function AttentionPanel({
  attention,
  events,
}: {
  attention: Asset['attention'];
  events: AssetEvent[];
}) {
  if (!attention || attention.criticality === 'NONE') return null;
  const isCritical = attention.criticality === 'CRITICAL';
  const headlineCount = isCritical
    ? attention.criticalEventCount
    : attention.lowEventCount;

  // Defensive: filter to active rows even though `events.active` already does
  // it server-side — covers legacy snapshots from before this query lived.
  const visibleEvents = [...events]
    .filter((e) => e.active !== false)
    .sort((a, b) => {
      const at = a.openedAt ? new Date(a.openedAt).getTime() : 0;
      const bt = b.openedAt ? new Date(b.openedAt).getTime() : 0;
      return bt - at;
    });

  return (
    <div
      className={`rounded-xl border ${
        isCritical
          ? 'border-red-200 bg-red-50'
          : 'border-amber-200 bg-amber-50'
      }`}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <svg
          className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
            isCritical ? 'text-red-600' : 'text-amber-600'
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v2m0 4h.01M4.93 19h14.14a2 2 0 001.74-3l-7.07-12a2 2 0 00-3.48 0L3.2 16a2 2 0 001.73 3z"
          />
        </svg>
        <div className="min-w-0 flex-1">
          <p
            className={`text-sm font-semibold ${
              isCritical ? 'text-red-900' : 'text-amber-900'
            }`}
          >
            {headlineCount} {isCritical ? 'critical' : 'low-severity'} event
            {headlineCount === 1 ? '' : 's'} open
          </p>
          <p
            className={`mt-0.5 text-xs ${
              isCritical ? 'text-red-700' : 'text-amber-700'
            }`}
          >
            {attention.criticalEventCount > 0 && (
              <span>
                Critical: <span className="tabular-nums font-medium">{attention.criticalEventCount}</span>
              </span>
            )}
            {attention.criticalEventCount > 0 && attention.lowEventCount > 0 && (
              <span className="mx-2">·</span>
            )}
            {attention.lowEventCount > 0 && (
              <span>
                Low: <span className="tabular-nums font-medium">{attention.lowEventCount}</span>
              </span>
            )}
            {attention.lastEventTime && (
              <>
                <span className="mx-2">·</span>
                <span>Last event {formatLastSeen(attention.lastEventTime)}</span>
              </>
            )}
          </p>
        </div>
      </div>

      {visibleEvents.length > 0 ? (
        <ul className="divide-y divide-white/60 border-t border-white/60">
          {visibleEvents.map((ev) => (
            <EventRow key={ev.id} event={ev} />
          ))}
        </ul>
      ) : (
        // We have a non-NONE criticality but no event details — either the
        // snapshot pre-dates Iter 8 OR Trackunit's count is non-zero while
        // the active list is empty (rare race). Show a hint, don't render
        // an empty list.
        <div className="border-t border-white/60 px-4 py-2.5 text-[11px] text-slate-600">
          Event detail not yet loaded — hit <span className="font-medium">Refresh now</span> above
          to pull the latest from Trackunit.
        </div>
      )}

      <div className="border-t border-white/60 px-4 py-2 text-[11px] text-slate-500">
        Manage events in Trackunit Manager.
      </div>
    </div>
  );
}

function EventRow({ event }: { event: AssetEvent }) {
  const isCritical = event.severity === 'CRITICAL';
  const isLow = event.severity === 'LOW';
  const pill = isCritical
    ? 'bg-red-100 text-red-800 ring-red-200'
    : isLow
      ? 'bg-amber-100 text-amber-800 ring-amber-200'
      : 'bg-slate-100 text-slate-700 ring-slate-200';

  // Description hierarchy: rich description > OEM description > prettified
  // enum. Many event types (DAMAGE_REPORT, SERVICE) leave both descriptions
  // null on the accounts we've seen.
  const message =
    event.description?.trim() ||
    event.descriptionPoweredByOem?.trim() ||
    prettifyEventType(event.type);

  return (
    <li className="px-4 py-2.5 flex items-start gap-3">
      <span
        className={`inline-flex flex-shrink-0 items-center rounded-full ring-1 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${pill}`}
      >
        {event.severity}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-900 line-clamp-2">
          {message}
          {event.count > 1 && (
            <span className="ml-1.5 text-xs font-medium text-slate-500 tabular-nums">
              ×{event.count}
            </span>
          )}
        </p>
        <p className="mt-0.5 text-[11px] text-slate-500">
          <span className="font-mono">{event.type}</span>
          {event.openedAt && (
            <>
              <span className="mx-1.5">·</span>
              <span>opened {formatLastSeen(event.openedAt)}</span>
            </>
          )}
        </p>
      </div>
    </li>
  );
}
