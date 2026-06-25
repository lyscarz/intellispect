import { activityOf } from '../lib/format';
import type { ActivityState } from '../types';

export default function StatusBadge({ activity }: { activity: ActivityState | null }) {
  const a = activityOf(activity);
  return (
    <span className="op-badge" style={{ color: a.color, background: a.bg }}>
      <span className="op-badge-dot" style={{ background: a.color }} />
      {a.label}
    </span>
  );
}
