'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import type { Asset } from '@/lib/types';
import { NoLocationPanel } from './NoLocationPanel';

// Leaflet must not render on the server
const MapView = dynamic(() => import('./MapView'), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center bg-slate-100 text-slate-400 text-sm">
      Loading map…
    </div>
  ),
});

interface Props {
  asset: Asset;
  onClose: () => void;
}

function formatTime(iso: string | null): string {
  if (!iso) return 'Unknown';
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) +
    ' · ' +
    d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

function formatAddress(asset: Asset): string {
  const a = asset.location?.address;
  if (!a) return 'No address available';
  return [a.street, a.city, a.country].filter(Boolean).join(', ');
}

const REFRESH_INTERVAL = 30_000; // 30 seconds

export function LiveLocationModal({ asset: initialAsset, onClose }: Props) {
  const [asset, setAsset] = useState<Asset>(initialAsset);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL / 1000);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/assets/${asset.assetId}`);
      if (res.ok) {
        const updated: Asset = await res.json();
        setAsset(updated);
        setLastRefreshed(new Date());
        setCountdown(REFRESH_INTERVAL / 1000);
      }
    } catch (e) {
      console.error('Location refresh failed', e);
    } finally {
      setRefreshing(false);
    }
  }, [asset.assetId]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    intervalRef.current = setInterval(refresh, REFRESH_INTERVAL);
    countdownRef.current = setInterval(() => {
      setCountdown((c) => (c <= 1 ? REFRESH_INTERVAL / 1000 : c - 1));
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [refresh]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const coords = asset.location?.coordinates;
  const address = formatAddress(asset);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: '90vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
              <h2 className="font-semibold text-slate-900">{asset.name}</h2>
            </div>
            {(asset.brand || asset.model) && (
              <p className="text-xs text-slate-500 mt-0.5 ml-4">
                {[asset.brand, asset.model].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Map */}
        <div className="flex-1 min-h-0" style={{ height: '380px' }}>
          {coords ? (
            <MapView
              lat={coords[1]}
              lng={coords[0]}
              label={asset.name}
              address={address}
            />
          ) : (
            <NoLocationPanel />
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-700 truncate">{address}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Location updated: {formatTime(asset.location?.updatedAt ?? null)}
              </p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className="text-xs text-slate-400 tabular-nums">
                Refresh in {countdown}s
              </span>
              <button
                onClick={refresh}
                disabled={refreshing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-medium
                  hover:bg-brand-700 disabled:opacity-60 transition-colors"
              >
                <svg
                  className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {refreshing ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>
          </div>
          <p className="text-xs text-slate-300 mt-2">
            Last fetched: {lastRefreshed.toLocaleTimeString()} · Auto-refreshes every 30 seconds
          </p>
        </div>
      </div>
    </div>
  );
}
