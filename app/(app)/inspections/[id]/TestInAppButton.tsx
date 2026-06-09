'use client';

import { useState } from 'react';
import { TestInAppModal } from './TestInAppModal';
import type { InspectionTemplate } from '@/lib/inspections/types';

export function TestInAppButton({ template }: { template: InspectionTemplate }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 inline-flex items-center gap-1.5"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        Test in app
      </button>
      {open && <TestInAppModal template={template} onClose={() => setOpen(false)} />}
    </>
  );
}
