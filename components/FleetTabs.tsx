import Link from 'next/link';
import type { Fleet } from '@/lib/types';
import { AddFleetButton } from './AddFleetButton';

interface Props {
  fleets: Fleet[];
  /** Total counts keyed by fleetId. Use the string 'unassigned' for the no-fleet bucket. */
  counts: Record<string, number>;
  /** Active fleet slug (from URL ?fleet=…). 'unassigned' or null means the Unassigned tab. */
  activeSlug: string | null;
  /** Where the tabs link to. `/fleet` for the machine list, `/sites` for site management. */
  urlBase: string;
}

export function FleetTabs({ fleets, counts, activeSlug, urlBase }: Props) {
  const unassignedCount = counts['unassigned'] ?? 0;

  return (
    <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto">
      {fleets.map((f) => {
        const count = counts[f.id] ?? 0;
        const active = activeSlug === f.slug;
        return (
          <Link
            key={f.id}
            href={`${urlBase}?fleet=${encodeURIComponent(f.slug)}`}
            className={`inline-flex items-center gap-2 whitespace-nowrap px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              active
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>#{f.slug}</span>
            <span className={`tabular-nums text-xs ${active ? 'text-brand-600' : 'text-slate-400'}`}>
              {count}
            </span>
          </Link>
        );
      })}

      {unassignedCount > 0 && (
        <Link
          href={`${urlBase}?fleet=unassigned`}
          className={`inline-flex items-center gap-2 whitespace-nowrap px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeSlug === 'unassigned'
              ? 'border-amber-500 text-amber-700'
              : 'border-transparent text-amber-700 hover:text-amber-900'
          }`}
        >
          <span>Unassigned</span>
          <span className="tabular-nums text-xs text-amber-500">{unassignedCount}</span>
        </Link>
      )}

      <AddFleetButton />
    </div>
  );
}
