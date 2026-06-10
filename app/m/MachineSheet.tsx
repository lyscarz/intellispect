'use client';

import { useEffect, useRef, useState } from 'react';

export type SheetSnap = 'closed' | 'peek' | 'expanded';

/** Mobile bottom-sheet with three snap points:
 *    closed    → translateY 100% (offscreen)
 *    peek      → ~70% offscreen (≈30% of viewport visible)
 *    expanded  → ~5% offscreen (≈95% of viewport visible)
 *
 *  Drag from the handle bar (or from anywhere in the always-visible "grab
 *  zone" at the top of the sheet) to snap between states. Touch-action: none
 *  on the grab zone keeps the browser from interpreting the swipe as a page
 *  scroll. Backdrop tap closes; Escape closes. */
export function MachineSheet({
  snap,
  onSnapChange,
  children,
  footer,
}: {
  snap: SheetSnap;
  onSnapChange: (next: SheetSnap) => void;
  children: React.ReactNode;
  /** Optional sticky footer rendered below the scrollable content
   *  (e.g. a check-out bar that stays visible while the user browses
   *  issues, telematics, etc.). */
  footer?: React.ReactNode;
}) {
  // Translation expressed as % of viewport. 100 = fully offscreen.
  const SNAP_TY: Record<SheetSnap, number> = {
    closed: 100,
    peek: 70,
    expanded: 5,
  };
  const [tyPct, setTyPct] = useState(SNAP_TY[snap]);
  const dragStart = useRef<{ y: number; tyPct: number } | null>(null);

  // Sync translation when external snap changes (open / close from caller).
  useEffect(() => {
    setTyPct(SNAP_TY[snap]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap]);

  // Lock body scroll while open.
  useEffect(() => {
    if (snap === 'closed') return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [snap]);

  // Escape to close.
  useEffect(() => {
    if (snap === 'closed') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSnapChange('closed');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [snap, onSnapChange]);

  function onPointerDown(clientY: number) {
    dragStart.current = { y: clientY, tyPct };
  }

  function onPointerMove(clientY: number) {
    if (!dragStart.current) return;
    const dy = clientY - dragStart.current.y;
    const viewportH = window.innerHeight;
    const next = dragStart.current.tyPct + (dy / viewportH) * 100;
    // Clamp 0..100 (not below the screen, not above the top).
    setTyPct(Math.min(100, Math.max(0, next)));
  }

  function onPointerEnd() {
    if (!dragStart.current) return;
    const startedAt = dragStart.current.tyPct;
    dragStart.current = null;
    // Snap to nearest of the three. If the drag distance is tiny we treat
    // it as a tap on the handle — toggle between peek and expanded.
    const delta = Math.abs(tyPct - startedAt);
    if (delta < 2) {
      // Tap-on-handle behaviour: peek ↔ expanded
      onSnapChange(snap === 'peek' ? 'expanded' : 'peek');
      return;
    }
    const distances = (Object.entries(SNAP_TY) as [SheetSnap, number][]).map(([k, v]) => ({
      k,
      d: Math.abs(v - tyPct),
    }));
    distances.sort((a, b) => a.d - b.d);
    onSnapChange(distances[0].k);
  }

  if (snap === 'closed' && tyPct >= 99.5) {
    return null;
  }

  const backdropOpacity = Math.max(0, Math.min(0.5, ((100 - tyPct) / 100) * 0.6));

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        style={{ backgroundColor: `rgba(15, 23, 42, ${backdropOpacity})` }}
        onClick={() => onSnapChange('closed')}
        aria-hidden
      />
      <div
        className="fixed left-0 right-0 bottom-0 z-50 bg-white rounded-t-2xl shadow-2xl flex flex-col"
        style={{
          height: '100vh',
          transform: `translateY(${tyPct}%)`,
          transition: dragStart.current ? 'none' : 'transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
        role="dialog"
        aria-modal="true"
      >
        {/* Grab zone — the visible drag-handle pill PLUS a generous touch
            target around it. touch-action: none stops the browser turning
            the gesture into a page scroll. */}
        <div
          className="flex-shrink-0 pt-2 pb-2 cursor-grab active:cursor-grabbing select-none"
          style={{ touchAction: 'none' }}
          onPointerDown={(e) => {
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            onPointerDown(e.clientY);
          }}
          onPointerMove={(e) => onPointerMove(e.clientY)}
          onPointerUp={(e) => {
            try {
              (e.target as HTMLElement).releasePointerCapture(e.pointerId);
            } catch {
              // ignore
            }
            onPointerEnd();
          }}
          onPointerCancel={onPointerEnd}
        >
          <div className="mx-auto w-12 h-1.5 rounded-full bg-slate-300" />
        </div>

        {/* Scrollable content */}
        <div
          className="flex-1 overflow-y-auto overscroll-contain"
          style={{ touchAction: 'pan-y' }}
        >
          {children}
        </div>

        {/* Optional sticky footer (e.g. check-out bar). */}
        {footer && (
          <div className="flex-shrink-0 border-t border-slate-200 bg-white">
            {footer}
          </div>
        )}
      </div>
    </>
  );
}
