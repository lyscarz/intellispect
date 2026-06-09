'use client';

import type { MachineContext } from '@/lib/inspections/types';

/** Small chip rendered inside the phone frame header so the operator (or
 *  admin testing) sees which machine the inspection is running against. */
export function MachineChip({ machine }: { machine: MachineContext | null }) {
  if (!machine) return null;
  const subtitle = [machine.brand, machine.model, machine.assetType]
    .filter(Boolean)
    .join(' · ');
  return (
    <div className="mx-3 mt-2 rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1.5 text-xs">
      <div className="font-semibold text-amber-900 truncate">{machine.name}</div>
      {subtitle && <div className="text-[11px] text-amber-700 truncate">{subtitle}</div>}
      {machine.siteName && (
        <div className="text-[10px] text-amber-600/70 mt-0.5 truncate">{machine.siteName}</div>
      )}
    </div>
  );
}
