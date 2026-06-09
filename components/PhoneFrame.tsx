'use client';

/**
 * Generic phone-frame shell. Renders a ~375x800 rounded device outline with a
 * notch and home-bar around its children. Pure presentational — no state.
 *
 * Used by the inspection-builder "Test in app" modal to preview/run an
 * inspection on a simulated mobile device. Reusable for any other mobile
 * preview surface in the app.
 */
export function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-[375px] h-[800px] bg-black rounded-[44px] p-2 shadow-2xl flex-shrink-0">
      {/* Inner screen */}
      <div className="relative w-full h-full bg-white rounded-[36px] overflow-hidden flex flex-col">
        {/* Status bar */}
        <div className="h-7 flex-shrink-0 flex items-center justify-between px-6 text-[11px] font-semibold text-slate-900 z-10 bg-white">
          <span>9:41</span>
          <span className="flex items-center gap-1">
            <span>•••</span>
            <span>📶</span>
            <span>🔋</span>
          </span>
        </div>
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-black rounded-b-2xl z-20" />

        {/* Content */}
        <div className="flex-1 min-h-0 flex flex-col bg-slate-50">{children}</div>

        {/* Home bar */}
        <div className="h-6 flex-shrink-0 flex items-center justify-center bg-white">
          <div className="w-32 h-1 bg-slate-800 rounded-full" />
        </div>
      </div>
    </div>
  );
}
