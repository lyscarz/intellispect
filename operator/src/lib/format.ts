import type { ActivityState } from '../types';

export function formatHours(h: number | null | undefined): string {
  if (h == null) return '—';
  return `${Math.round(h).toLocaleString('en-US')} h`;
}

export function formatPercent(p: number | null | undefined): string {
  if (p == null) return '—';
  return `${Math.round(p)}%`;
}

export function formatKm(km: number | null | undefined): string {
  if (km == null) return '';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(km < 10 ? 1 : 0)} km`;
}

export function formatLastSeen(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day} d ago`;
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

// Deterministic [bg, fg] colour pair per brand/name for placeholder thumbnails.
const BRAND_COLORS: Array<[string, string]> = [
  ['#dbeafe', '#1e3a8a'],
  ['#dcfce7', '#166534'],
  ['#fef3c7', '#92400e'],
  ['#fee2e2', '#991b1b'],
  ['#ede9fe', '#5b21b6'],
  ['#cffafe', '#155e75'],
  ['#fce7f3', '#9d174d'],
  ['#e2e8f0', '#334155'],
];

export function brandColors(s: string | null | undefined): [string, string] {
  const key = (s ?? '?').trim();
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return BRAND_COLORS[hash % BRAND_COLORS.length];
}

export function assetInitials(s: string | null | undefined): string {
  const t = (s ?? '?').trim();
  if (!t) return '?';
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export const ACTIVITY: Record<
  ActivityState,
  { label: string; color: string; bg: string }
> = {
  WORKING: { label: 'Working', color: '#047857', bg: 'rgba(16,185,129,0.16)' },
  IDLING: { label: 'Idling', color: '#b45309', bg: 'rgba(245,158,11,0.18)' },
  STOPPED: { label: 'Stopped', color: '#475569', bg: 'rgba(100,116,139,0.16)' },
  UNKNOWN: { label: 'Unknown', color: '#64748b', bg: 'rgba(100,116,139,0.12)' },
};

export function activityOf(a: ActivityState | null | undefined) {
  return ACTIVITY[a ?? 'UNKNOWN'];
}
