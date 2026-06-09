interface Props {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  /** 0-100 — renders a progress bar when provided */
  percent?: number | null;
  barColor?: string;
}

export function TelematicsMetric({ icon, label, value, percent, barColor = 'bg-brand-500' }: Props) {
  const hasBar = percent != null;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-slate-500">
        <span className="w-4 h-4 flex-shrink-0">{icon}</span>
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-sm font-semibold text-slate-800">
          {value ?? <span className="text-slate-400 text-xs">N/A</span>}
        </span>
      </div>
      {hasBar && value !== null && (
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${Math.min(100, Math.max(0, percent ?? 0))}%` }}
          />
        </div>
      )}
    </div>
  );
}

// Shared SVG icons kept small and inline
export const Icons = {
  fuel: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 22V8a2 2 0 012-2h8a2 2 0 012 2v14" />
      <path d="M3 22h12" />
      <path d="M15 10h2a2 2 0 012 2v2a2 2 0 002 2h0a2 2 0 002-2V8l-3-3" />
      <line x1="7" y1="22" x2="7" y2="11" />
    </svg>
  ),
  battery: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="16" height="10" rx="2" />
      <path d="M22 11v2" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  wrench: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
    </svg>
  ),
};
