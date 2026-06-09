/**
 * Shared formatters and visual helpers used by MachineCard, FleetList, and
 * the machine home page. Extracted to keep behaviour identical across views.
 */

export function formatHours(h: number | null): string | null {
  if (h == null) return null;
  return `${Math.round(h).toLocaleString()} h`;
}

export function formatPercent(p: number | null): string | null {
  if (p == null) return null;
  return `${Math.round(p)}%`;
}

export function fuelBarColor(p: number | null): string {
  if (p == null) return 'bg-slate-300';
  if (p < 20) return 'bg-red-500';
  if (p < 40) return 'bg-amber-400';
  return 'bg-emerald-500';
}

export function batteryBarColor(p: number | null): string {
  if (p == null) return 'bg-slate-300';
  if (p < 20) return 'bg-red-500';
  if (p < 40) return 'bg-amber-400';
  return 'bg-brand-500';
}

export function formatLastSeen(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  // Deterministic UTC formatting — avoids server/client hydration mismatch.
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const h = String(d.getUTCHours()).padStart(2, '0');
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${h}:${m}`;
}

const BRAND_COLORS: [string, string][] = [
  ['bg-amber-100', 'text-amber-700'],
  ['bg-sky-100', 'text-sky-700'],
  ['bg-emerald-100', 'text-emerald-700'],
  ['bg-violet-100', 'text-violet-700'],
  ['bg-rose-100', 'text-rose-700'],
  ['bg-orange-100', 'text-orange-700'],
  ['bg-teal-100', 'text-teal-700'],
  ['bg-indigo-100', 'text-indigo-700'],
];

export function brandColors(brand: string | null): [string, string] {
  if (!brand) return ['bg-slate-100', 'text-slate-400'];
  let hash = 0;
  for (let i = 0; i < brand.length; i++) hash = brand.charCodeAt(i) + ((hash << 5) - hash);
  return BRAND_COLORS[Math.abs(hash) % BRAND_COLORS.length];
}

/**
 * Decide whether a machine is most likely electric or combustion-powered.
 * Strategy:
 *   1. If snapshot insights tell us (battery present → electric; fuel present → combustion), trust that.
 *   2. Otherwise pattern-match the model / type string for common conventions.
 *   3. Fall back to 'unknown'.
 */
export type PowerSource = 'electric' | 'combustion' | 'unknown';

export function powerSourceFor(args: {
  model: string | null;
  assetType: string | null;
  fuelLevel: number | null;
  batteryStateOfChargePercent: number | null;
}): PowerSource {
  if (args.batteryStateOfChargePercent != null) return 'electric';
  if (args.fuelLevel != null) return 'combustion';
  const hay = `${args.model ?? ''} ${args.assetType ?? ''}`.toUpperCase();
  if (/\b(?:ES|EV|ELECTRIC|BATTERY|LITHIUM|HYBRID|LI[- ]ION)\b/.test(hay)) return 'electric';
  if (/\b(?:DIESEL|GASOLINE|PETROL|ICE|DUAL[- ]FUEL|GAS)\b/.test(hay)) return 'combustion';
  return 'unknown';
}

export function assetInitials(brandOrName: string | null): string {
  if (!brandOrName) return '?';
  return brandOrName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * Humanise Trackunit's `LegacyAssetEventType` enum (e.g. `DAMAGE_REPORT` →
 * "Damage report", `ENGINE_FAULT` → "Engine fault"). Used as a fallback when
 * the event's `description` is null — common for status-type events on the
 * accounts we've seen.
 */
export function prettifyEventType(type: string | null | undefined): string {
  if (!type) return 'Event';
  return type
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());
}
