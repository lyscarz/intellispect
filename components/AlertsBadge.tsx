import type { AssetAttention } from '@/lib/types';

/**
 * Shared red/amber criticality pill driven by `Asset.status.attention`.
 *
 *   - CRITICAL → red pill with count of `criticalEventCount`
 *   - LOW      → amber pill with count of `lowEventCount`
 *   - NONE / null → nothing rendered
 *
 * Sized to fit inline next to source/type pills in row layouts and the
 * machine home header. Pass `size="lg"` for the header.
 */
export function AlertsBadge({
  attention,
  size = 'sm',
}: {
  attention: AssetAttention | null | undefined;
  size?: 'sm' | 'lg';
}) {
  if (!attention) return null;
  if (attention.criticality === 'NONE') return null;

  const isCritical = attention.criticality === 'CRITICAL';
  const count = isCritical
    ? attention.criticalEventCount
    : attention.lowEventCount;

  // Show the pill even when count is 0 — Trackunit's criticality rollup can
  // remain CRITICAL/LOW briefly while the count drops to 0 on the next sync.
  // We render the pill but hide the count in that case.
  const colour = isCritical
    ? 'bg-red-100 text-red-700 ring-red-200'
    : 'bg-amber-100 text-amber-800 ring-amber-200';

  const dims =
    size === 'lg'
      ? 'px-2.5 py-1 text-xs gap-1.5'
      : 'px-1.5 py-0.5 text-[10px] gap-1';

  const iconSize = size === 'lg' ? 'w-3.5 h-3.5' : 'w-3 h-3';

  return (
    <span
      className={`inline-flex items-center rounded-full ring-1 font-semibold ${colour} ${dims}`}
      title={
        isCritical
          ? `${count} critical event${count === 1 ? '' : 's'} from Trackunit`
          : `${count} low-severity event${count === 1 ? '' : 's'} from Trackunit`
      }
    >
      <svg
        className={iconSize}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2.25}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v2m0 4h.01M4.93 19h14.14a2 2 0 001.74-3l-7.07-12a2 2 0 00-3.48 0L3.2 16a2 2 0 001.73 3z"
        />
      </svg>
      {count > 0 && <span className="tabular-nums">{count}</span>}
    </span>
  );
}
