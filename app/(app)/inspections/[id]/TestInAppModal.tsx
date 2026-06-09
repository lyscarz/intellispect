'use client';

import { useEffect } from 'react';
import { PhoneFrame } from '@/components/PhoneFrame';
import { MobileFormRunner } from './MobileFormRunner';
import { MobileIntentRunner } from './MobileIntentRunner';
import type { InspectionTemplate, MachineContext } from '@/lib/inspections/types';

export function TestInAppModal({
  template,
  machine,
  onClose,
}: {
  template: InspectionTemplate;
  machine?: MachineContext | null;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative flex flex-col items-center gap-3">
        <div className="flex items-center gap-2 text-white text-sm">
          <span className="font-semibold">Test in app</span>
          <span className="text-white/60">·</span>
          <span className="font-mono text-amber-200">/{template.handle}</span>
        </div>
        <PhoneFrame>
          {template.kind === 'form' ? (
            <MobileFormRunner template={template} machine={machine ?? null} />
          ) : (
            <MobileIntentRunner template={template} machine={machine ?? null} />
          )}
        </PhoneFrame>
        <button
          type="button"
          onClick={onClose}
          className="absolute top-0 right-0 -mr-12 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
