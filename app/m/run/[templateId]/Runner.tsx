'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MobileFormRunner } from '@/app/(app)/inspections/[id]/MobileFormRunner';
import type { InspectionTemplate, MachineContext } from '@/lib/inspections/types';

export function Runner({
  template,
  machine,
  siteId,
}: {
  template: InspectionTemplate;
  machine: MachineContext | null;
  siteId: string | null;
}) {
  const router = useRouter();
  return (
    <>
      <header className="px-4 py-2 border-b border-slate-200 bg-white flex items-center gap-2">
        <Link
          href={machine ? `/m/machine/${machine.id}` : '/m'}
          className="text-slate-500 inline-flex items-center gap-1 text-xs"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </Link>
      </header>
      <MobileFormRunner
        template={template}
        machine={machine}
        siteId={siteId}
        onSubmitted={(responseId) => router.push(`/m/done/${responseId}`)}
      />
    </>
  );
}
