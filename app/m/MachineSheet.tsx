'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export type SheetSnap = 'closed' | 'bar' | 'peek' | 'expanded';

// Drag-pill area (24px) + content row (~56px). Total visible at bar snap.
const BAR_HEIGHT_PX = 80;
// Mobile tab bar height (matches MobileTabBar h-14 / py-2.5).
const TAB_BAR_PX = 56;
// Small map sliver shown above the sheet when fully expanded.
const TOP_GAP_PX = 24;

function visiblePxFor(snap: SheetSnap, sheetH: number): number {
  switch (snap) {
    case 'closed':
      return 0;
    case 'bar':
      return BAR_HEIGHT_PX;
    case 'peek':
      return Math.round(sheetH * 0.42);
    case 'expanded':
      return sheetH;
  }
}

function tyForSnap(snap: SheetSnap, sheetH: number): number {
  return sheetH - visiblePxFor(snap, sheetH);
}

/** iOS-style bottom sheet with four snap points (closed / bar / peek /
 *  expanded). Sits ABOVE the mobile tab bar — the tab bar stays visible at
 *  every snap state so the sheet feels like a layer that slides up over the
 *  map, never replacing the chrome. Pixel-based translation, velocity-aware
 *  release, rubber-band edges, iOS spring curve. */
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
  /** Persistent emerald row rendered at the bottom of the sheet. When set,
   *  the sheet's minimum visible state should be `bar` (so the operator
   *  always sees their session status). */
  barContent?: React.ReactNode;
  /** Which snaps the user can reach by dragging. Defaults to all 4. */
  availableSnaps?: SheetSnap[];
}) {
  const snaps = availableSnaps ?? (['closed', 'bar', 'peek', 'expanded'] as SheetSnap[]);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [sheetH, setSheetH] = useState(() =>
    typeof window === 'undefined'
      ? 600
      : Math.max(200, window.innerHeight - TAB_BAR_PX - TOP_GAP_PX)
  );
  const [ty, setTy] = useState(() => tyForSnap(snap, sheetH));
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ y: number; ty: number } | null>(null);
  const samples = useRef<{ y: number; t: number }[]>([]);

  // Measure actual sheet height (CSS calc handles safe-area-inset, JS reads
  // back the pixel value so snap math stays accurate on notched devices).
  useLayoutEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    const measure = () => {
      const h = el.offsetHeight;
      if (h > 0) setSheetH(h);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  // Re-anchor ty whenever snap or sheet height changes (and not mid-drag).
  useEffect(() => {
    if (!dragging) setTy(tyForSnap(snap, sheetH));
  }, [snap, sheetH, dragging]);

  // Lock body scroll only when we're above the bar state.
  useEffect(() => {
    if (snap === 'closed' || snap === 'bar') return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [snap]);

  // Escape drops one snap level (expanded → peek → bar/closed).
  useEffect(() => {
    if (snap === 'closed' || snap === 'bar') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const i = snaps.indexOf(snap);
        onSnapChange(snaps[Math.max(0, i - 1)]);
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
      const minTy = tyForSnap(snaps[snaps.length - 1], sheetH);
      const maxTy = tyForSnap(snaps[0], sheetH);
      if (next < minTy) next = minTy - Math.pow(minTy - next, 0.7);
      if (next > maxTy) next = maxTy + Math.pow(next - maxTy, 0.7);
      setTy(next);
      samples.current.push({ y: clientY, t: performance.now() });
      const cutoff = performance.now() - 120;
      samples.current = samples.current.filter((s) => s.t >= cutoff);
    },
    [snaps, sheetH]
  );

  const endDrag = useCallback(() => {
    if (!dragStart.current) return;
    const startedAt = dragStart.current.ty;
    dragStart.current = null;
    setDragging(false);

    let velocity = 0;
    if (samples.current.length >= 2) {
      const first = samples.current[0];
      const last = samples.current[samples.current.length - 1];
      const dt = last.t - first.t;
      if (dt > 0) velocity = (last.y - first.y) / dt;
    }
    samples.current = [];

    // Tap on the handle (no real movement) → toggle between states.
    if (Math.abs(ty - startedAt) < 4 && Math.abs(velocity) < 0.2) {
      if (snap === 'peek') return onSnapChange('expanded');
      if (snap === 'expanded') return onSnapChange('peek');
      if (snap === 'bar') return onSnapChange('expanded');
    }

    // Project final position by 150ms of velocity (iOS-ish flick feel).
    const projected = ty + velocity * 150;
    const candidates = snaps.map((s) => ({ s, p: tyForSnap(s, sheetH) }));
    candidates.sort((a, b) => Math.abs(a.p - projected) - Math.abs(b.p - projected));
    onSnapChange(candidates[0].s);
  }, [ty, snap, snaps, sheetH, onSnapChange]);

  // Backdrop dim ramps from 0 below peek up to 0.4 at expanded.
  const expandedPx = tyForSnap('expanded', sheetH);
  const closedPx = tyForSnap('closed', sheetH);
  const range = Math.max(1, closedPx - expandedPx);
  const fraction = Math.max(0, Math.min(1, (closedPx - ty) / range));
  const peekFraction = (closedPx - tyForSnap('peek', sheetH)) / range;
  const backdropOpacity = Math.max(
    0,
    Math.min(0.35, ((fraction - peekFraction) / Math.max(0.001, 1 - peekFraction)) * 0.35)
  );

  // If fully closed and bar isn't reachable, don't render anything.
  const fullyClosedAndDismissed =
    snap === 'closed' && !snaps.includes('bar') && Math.abs(ty - closedPx) < 1;

  const dragHandlers = {
    onPointerDown: (e: React.PointerEvent) => {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      beginDrag(e.clientY);
    },
    onPointerMove: (e: React.PointerEvent) => updateDrag(e.clientY),
    onPointerUp: (e: React.PointerEvent) => {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      endDrag();
    },
    onPointerCancel: endDrag,
  };

  return (
    <>
      {/* Backdrop — z-10, below the sheet (z-20) and the tab bar (z-30).
          Restricted to ABOVE the tab bar so the tab bar stays bright/untouched. */}
      {!fullyClosedAndDismissed && backdropOpacity > 0.005 && (
        <div
          className="fixed left-0 right-0 top-0 z-10 transition-[background-color] duration-300"
          style={{
            bottom: `calc(env(safe-area-inset-bottom) + ${TAB_BAR_PX}px)`,
            backgroundColor: `rgba(15, 23, 42, ${backdropOpacity})`,
          }}
          onClick={() => {
            const i = snaps.indexOf(snap);
            onSnapChange(snaps[Math.max(0, i - 1)]);
          }}
          aria-hidden
        />
      )}

      {/* Sheet — z-20, below the tab bar (z-30) so the tab bar always shows.
          Bottom sits exactly on top of the tab bar; height fills the
          remaining viewport minus a small top gap for the map. */}
      {!fullyClosedAndDismissed && (
        <div
          ref={sheetRef}
          className="fixed left-0 right-0 z-20 flex flex-col rounded-t-3xl shadow-[0_-12px_40px_-12px_rgba(15,23,42,0.35)]"
          style={{
            bottom: `calc(env(safe-area-inset-bottom) + ${TAB_BAR_PX}px)`,
            height: `calc(100vh - env(safe-area-inset-bottom) - ${TAB_BAR_PX}px - ${TOP_GAP_PX}px)`,
            transition: dragging
              ? 'none'
              : 'transform 320ms cubic-bezier(0.32, 0.72, 0, 1)',
            transform: `translate3d(0, ${ty}px, 0)`,
            // When a bar is set, the sheet's "frame" is emerald so the drag
            // collar at the top blends into the bar at the bottom visually.
            background: barContent ? '#059669' : '#ffffff',
          }}
          role="dialog"
          aria-modal={snap === 'expanded' ? true : undefined}
        >
          {/* Top drag handle — primary grab area at peek/expanded. Hidden
              visually at bar snap (we render a pill inside the bar instead),
              but the area is still draggable. */}
          <div
            className="flex-shrink-0 select-none cursor-grab active:cursor-grabbing"
            style={{
              touchAction: 'none',
              borderTopLeftRadius: '24px',
              borderTopRightRadius: '24px',
            }}
            {...dragHandlers}
          >
            <div
              className="mx-auto w-9 h-1.5 rounded-full mt-2 mb-2 transition-opacity duration-200"
              style={{
                background: barContent ? 'rgba(255,255,255,0.6)' : '#cbd5e1',
                // Fade the top pill out as we approach the bar snap so the
                // bar's own pill becomes the single visual handle.
                opacity: snap === 'bar' ? 0 : 1,
              }}
            />
          </div>

          {/* Scrollable children — sits in a white panel between the drag
              collar and the bar (when bar exists), or fills the rest of the
              sheet (when no bar). */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div
              className="flex-1 overflow-y-auto overscroll-contain"
              style={{
                touchAction: 'pan-y',
                background: '#ffffff',
              }}
            >
              {children}
            </div>

            {footer && (snap === 'expanded' || dragging) && (
              <div className="flex-shrink-0 border-t border-slate-200 bg-white">
                {footer}
              </div>
            )}
          </div>

          {/* Persistent bar at sheet bottom. Visible at every snap when
              barContent is set; at `bar` snap it's the ONLY visible part of
              the sheet. Carries its own drag pill so the operator always has
              somewhere to grab. */}
          {barContent && (
            <div
              className="flex-shrink-0 bg-emerald-600 text-white"
              style={{ minHeight: `${BAR_HEIGHT_PX}px` }}
            >
              <div
                className="select-none cursor-grab active:cursor-grabbing"
                style={{ touchAction: 'none' }}
                {...dragHandlers}
              >
                <div
                  className="mx-auto w-9 h-1.5 rounded-full pt-0 mt-2 mb-1 transition-opacity duration-200"
                  style={{
                    background: 'rgba(255,255,255,0.6)',
                    // Fade the bar's pill out at expanded so the top pill
                    // becomes the single visual handle.
                    opacity: snap === 'expanded' ? 0 : 1,
                  }}
                />
              </div>
              {barContent}
            </div>
          )}
        </div>
      )}
    </>
  );
}
