'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export type SheetSnap = 'closed' | 'bar' | 'peek' | 'expanded';

const BAR_HEIGHT_PX = 72; // height of the compact green session row
const SHEET_HEIGHT_VH = 0.95; // 95vh

/** Returns how many pixels of the sheet are visible at each snap point. */
function visiblePxFor(snap: SheetSnap, viewportH: number): number {
  switch (snap) {
    case 'closed':
      return 0;
    case 'bar':
      return BAR_HEIGHT_PX;
    case 'peek':
      return Math.round(viewportH * 0.32);
    case 'expanded':
      return Math.round(viewportH * SHEET_HEIGHT_VH);
  }
}

/** Returns the translateY (px) for a given snap state, given viewport height. */
function tyForSnap(snap: SheetSnap, viewportH: number): number {
  const sheetPx = Math.round(viewportH * SHEET_HEIGHT_VH);
  const visible = visiblePxFor(snap, viewportH);
  return sheetPx - visible;
}

/** iOS-style bottom sheet with four snap points (closed / bar / peek /
 *  expanded). Pixel-based translation + velocity-aware snap on release + a
 *  smoother spring curve. Optional `barContent` is rendered ONLY when the
 *  sheet is at the `bar` snap — gives the operator a persistent "checked in"
 *  pill that they can drag up to reveal `children`. */
export function MachineSheet({
  snap,
  onSnapChange,
  children,
  footer,
  barContent,
  availableSnaps,
}: {
  snap: SheetSnap;
  onSnapChange: (next: SheetSnap) => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Content shown in the compact (bar) state instead of children. */
  barContent?: React.ReactNode;
  /** Which snaps the user can reach by dragging. Defaults to all 4. */
  availableSnaps?: SheetSnap[];
}) {
  const snaps = availableSnaps ?? (['closed', 'bar', 'peek', 'expanded'] as SheetSnap[]);
  const [viewportH, setViewportH] = useState(() =>
    typeof window === 'undefined' ? 800 : window.innerHeight
  );
  const [ty, setTy] = useState(() => tyForSnap(snap, viewportH));
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ y: number; ty: number } | null>(null);
  // Track recent pointer events for velocity (px / ms).
  const samples = useRef<{ y: number; t: number }[]>([]);

  // Resize-aware: re-clamp on viewport change.
  useLayoutEffect(() => {
    const onResize = () => {
      const h = window.innerHeight;
      setViewportH(h);
      setTy(tyForSnap(snap, h));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [snap]);

  // Animate to the requested snap whenever it changes externally.
  useEffect(() => {
    if (!dragging) setTy(tyForSnap(snap, viewportH));
  }, [snap, viewportH, dragging]);

  // Lock body scroll while open (not at closed). Bar state stays interactive.
  useEffect(() => {
    if (snap === 'closed' || snap === 'bar') return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [snap]);

  // Escape closes (to bar if checked in, else closed) — caller decides via
  // availableSnaps.
  useEffect(() => {
    if (snap === 'closed' || snap === 'bar') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Fall back to the smallest available state below current.
        const next = snaps.includes('bar') ? 'bar' : 'closed';
        onSnapChange(next);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [snap, onSnapChange, snaps]);

  const beginDrag = useCallback(
    (clientY: number) => {
      dragStart.current = { y: clientY, ty };
      samples.current = [{ y: clientY, t: performance.now() }];
      setDragging(true);
    },
    [ty]
  );

  const updateDrag = useCallback(
    (clientY: number) => {
      if (!dragStart.current) return;
      const dy = clientY - dragStart.current.y;
      let next = dragStart.current.ty + dy;
      const minTy = tyForSnap(snaps[snaps.length - 1], viewportH); // expanded
      const maxTy = tyForSnap(snaps[0], viewportH); // closed (or bar if no closed)
      // Rubber-band resistance past the boundaries (iOS-style).
      if (next < minTy) next = minTy - Math.pow(minTy - next, 0.7);
      if (next > maxTy) next = maxTy + Math.pow(next - maxTy, 0.7);
      setTy(next);
      samples.current.push({ y: clientY, t: performance.now() });
      // Keep last ~120ms of samples for velocity calc.
      const cutoff = performance.now() - 120;
      samples.current = samples.current.filter((s) => s.t >= cutoff);
    },
    [snaps, viewportH]
  );

  const endDrag = useCallback(() => {
    if (!dragStart.current) return;
    const startedAt = dragStart.current.ty;
    dragStart.current = null;
    setDragging(false);

    // Velocity in px/ms over the last 120ms of samples.
    let velocity = 0;
    if (samples.current.length >= 2) {
      const first = samples.current[0];
      const last = samples.current[samples.current.length - 1];
      const dt = last.t - first.t;
      if (dt > 0) velocity = (last.y - first.y) / dt;
    }
    samples.current = [];

    // Tap on the handle (no real movement) → toggle peek ↔ expanded.
    if (Math.abs(ty - startedAt) < 4 && Math.abs(velocity) < 0.2) {
      if (snap === 'peek') return onSnapChange('expanded');
      if (snap === 'expanded') return onSnapChange('peek');
      if (snap === 'bar') return onSnapChange('expanded');
    }

    // Project final position by 150ms of velocity (iOS-ish flick feel).
    const projected = ty + velocity * 150;
    // Snap to the nearest available state to the projection.
    const candidates = snaps.map((s) => ({ s, p: tyForSnap(s, viewportH) }));
    candidates.sort((a, b) => Math.abs(a.p - projected) - Math.abs(b.p - projected));
    onSnapChange(candidates[0].s);
  }, [ty, snap, snaps, viewportH, onSnapChange]);

  // Visible-fraction of the sheet relative to expanded, for backdrop dim.
  const expandedPx = tyForSnap('expanded', viewportH);
  const closedPx = tyForSnap('closed', viewportH);
  const fraction = Math.max(0, Math.min(1, (closedPx - ty) / (closedPx - expandedPx)));
  // Dim ramps from 0 below peek up to 0.4 at expanded.
  const peekFraction =
    (closedPx - tyForSnap('peek', viewportH)) / (closedPx - expandedPx);
  const backdropOpacity = Math.max(
    0,
    Math.min(0.4, ((fraction - peekFraction) / (1 - peekFraction)) * 0.4)
  );

  // Don't render at all when fully closed AND no bar.
  if (snap === 'closed' && !snaps.includes('bar') && Math.abs(ty - closedPx) < 1) {
    return null;
  }

  // Bar-only rendering when snap === 'bar' AND we're not dragging upward beyond bar.
  const inBarOrAbove = ty <= tyForSnap('bar', viewportH) + 0.5;
  const showBarOnly = snap === 'bar' && !dragging;
  const showFullContent = inBarOrAbove || dragging;

  return (
    <>
      {/* Backdrop */}
      {backdropOpacity > 0.01 && (
        <div
          className="fixed inset-0 z-40 transition-[background-color] duration-300"
          style={{ backgroundColor: `rgba(15, 23, 42, ${backdropOpacity})` }}
          onClick={() => {
            // Tapping the dim drops to the next-smallest available snap.
            const i = snaps.indexOf(snap);
            const next = snaps[Math.max(0, i - 1)];
            onSnapChange(next);
          }}
          aria-hidden
        />
      )}
      <div
        className="fixed left-0 right-0 bottom-0 z-50 flex flex-col rounded-t-3xl shadow-[0_-12px_40px_-12px_rgba(15,23,42,0.35)]"
        style={{
          height: `${SHEET_HEIGHT_VH * 100}vh`,
          // iOS-feel spring curve when settling; none while dragging.
          transition: dragging
            ? 'none'
            : 'transform 320ms cubic-bezier(0.32, 0.72, 0, 1)',
          transform: `translate3d(0, ${ty}px, 0)`,
          // Visual: emerald background showing through the bar at the bottom
          // when checked in; the inner content sits in a white panel that
          // covers from the drag handle down to the bar's top edge.
          background: barContent ? '#059669' : '#ffffff',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
        role="dialog"
        aria-modal={snap === 'expanded' ? true : undefined}
      >
        {/* Drag handle — pointer events, touch-action:none so the browser
            doesn't grab the gesture as a scroll. */}
        <div
          className="flex-shrink-0 select-none cursor-grab active:cursor-grabbing"
          style={{
            touchAction: 'none',
            // Slightly different look depending on whether we're on a white
            // panel (no barContent) or the emerald layer (bar visible).
            background: barContent ? 'transparent' : '#ffffff',
            borderTopLeftRadius: '24px',
            borderTopRightRadius: '24px',
          }}
          onPointerDown={(e) => {
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            beginDrag(e.clientY);
          }}
          onPointerMove={(e) => updateDrag(e.clientY)}
          onPointerUp={(e) => {
            try {
              (e.target as HTMLElement).releasePointerCapture(e.pointerId);
            } catch {
              // ignore
            }
            endDrag();
          }}
          onPointerCancel={endDrag}
        >
          <div
            className="mx-auto w-9 h-1.5 rounded-full mt-2 mb-2"
            style={{ background: barContent ? 'rgba(255,255,255,0.55)' : '#cbd5e1' }}
          />
        </div>

        {/* Content layer. Two visual modes:
            - if barContent provided and at/near bar: show barContent + behind
              it the scrollable children peeking up when dragged.
            - otherwise: just the scrollable children. */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {showFullContent && (
            <div
              className="flex-1 overflow-y-auto overscroll-contain"
              style={{
                touchAction: 'pan-y',
                background: '#ffffff',
                // Round-bottom only when there's a bar below (the bar gets
                // the sheet's bottom corners then).
              }}
            >
              {children}
            </div>
          )}

          {/* Sticky footer (only meaningful at expanded). */}
          {footer && (snap === 'expanded' || dragging) && (
            <div
              className="flex-shrink-0 border-t border-slate-200 bg-white"
            >
              {footer}
            </div>
          )}
        </div>

        {/* Persistent bar — visible at every snap state when barContent is set.
            Sits at the bottom of the sheet, with safe-area padding already
            applied to the parent. */}
        {barContent && (
          <div
            className="flex-shrink-0 bg-emerald-600 text-white"
            style={{ minHeight: `${BAR_HEIGHT_PX}px` }}
          >
            {barContent}
          </div>
        )}
      </div>
    </>
  );
}
