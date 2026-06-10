'use client';

import { useEffect, useRef, useState } from 'react';

export type SheetSnap = 'closed' | 'peek' | 'expanded';

/** Mobile bottom-sheet with three snap points:
 *    closed    → translateY 100% (offscreen)
 *    peek      → ~70% offscreen (≈30% of viewport visible)
 *    expanded  → ~10% offscreen (~90% of viewport visible)
 *  Supports touch drag with momentum-friendly snap-on-release. Backdrop tap
 *  closes. The expanded state lets the inner content scroll. */
export function MachineSheet({
  snap,
  onSnapChange,
  children,
}: {
  snap: SheetSnap;
  onSnapChange: (next: SheetSnap) => void;
  children: React.ReactNode;
}) {
  // Translation expressed as % of viewport. 100 = fully offscreen.
  const SNAP_TY: Record<SheetSnap, number> = {
    closed: 100,
    peek: 70,
    expanded: 10,
  };
  const [tyPct, setTyPct] = useState(SNAP_TY[snap]);
  const dragStart = useRef<{ y: number; tyPct: number } | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);

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

  function onTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    dragStart.current = { y: e.touches[0].clientY, tyPct };
  }

  function onTouchMove(e: React.TouchEvent<HTMLDivElement>) {
    if (!dragStart.current) return;
    const dy = e.touches[0].clientY - dragStart.current.y;
    const viewportH = window.innerHeight;
    const next = dragStart.current.tyPct + (dy / viewportH) * 100;
    // Clamp 0..100 (not below the screen, not above the top).
    setTyPct(Math.min(100, Math.max(0, next)));
  }

  function onTouchEnd() {
    if (!dragStart.current) return;
    dragStart.current = null;
    // Snap to nearest of the three.
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

  const backdropOpacity = Math.max(0, Math.min(0.5, (100 - tyPct) / 100 * 0.6));

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        style={{ backgroundColor: `rgba(15, 23, 42, ${backdropOpacity})` }}
        onClick={() => onSnapChange('closed')}
        aria-hidden
      />
      <div
        ref={sheetRef}
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
        {/* Drag handle */}
        <div
          className="flex-shrink-0 pt-2 pb-1 cursor-grab active:cursor-grabbing"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="mx-auto w-10 h-1.5 rounded-full bg-slate-300" />
        </div>
        {/* Content */}
        <div
          className="flex-1 overflow-y-auto"
          // Allow drag start from any blank area at the very top of content too
          // (most users will grab the handle but it's a nice touch).
          onTouchStart={(e) => {
            // Only treat as drag-start if the content is scrolled to the very top.
            const el = e.currentTarget;
            if (el.scrollTop <= 0) onTouchStart(e);
          }}
          onTouchMove={(e) => {
            if (dragStart.current) onTouchMove(e);
          }}
          onTouchEnd={onTouchEnd}
        >
          {children}
        </div>
      </div>
    </>
  );
}
