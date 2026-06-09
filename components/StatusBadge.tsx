import type { ActivityState } from '@/lib/types';

const config: Record<ActivityState, { label: string; classes: string; dot: string }> = {
  WORKING: {
    label: 'Working',
    classes: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    dot: 'bg-emerald-500',
  },
  IDLING: {
    label: 'Idling',
    classes: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    dot: 'bg-amber-400',
  },
  STOPPED: {
    label: 'Stopped',
    classes: 'bg-slate-100 text-slate-600 ring-slate-500/20',
    dot: 'bg-slate-400',
  },
  UNKNOWN: {
    label: 'Unknown',
    classes: 'bg-slate-100 text-slate-500 ring-slate-400/20',
    dot: 'bg-slate-300',
  },
};

export function StatusBadge({ activity }: { activity: ActivityState | null }) {
  const state = activity ?? 'UNKNOWN';
  const { label, classes, dot } = config[state];

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${classes}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot} ${state === 'WORKING' ? 'animate-pulse' : ''}`} />
      {label}
    </span>
  );
}
