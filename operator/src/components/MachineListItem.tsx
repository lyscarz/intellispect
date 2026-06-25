import type { FleetMachine } from '../types';
import {
  assetInitials,
  brandColors,
  formatKm,
  formatHours,
  formatPercent,
} from '../lib/format';
import StatusBadge from './StatusBadge';

export default function MachineListItem({
  machine,
  onClick,
}: {
  machine: FleetMachine;
  onClick?: () => void;
}) {
  const [bg, fg] = brandColors(machine.brand ?? machine.name);
  const subtitle =
    [machine.brand, machine.model].filter(Boolean).join(' · ') || machine.assetType;

  return (
    <li>
      <a className="item-link item-content" onClick={onClick}>
        <div className="item-media">
          <div className="op-thumb" style={{ background: bg, color: fg }}>
            {assetInitials(machine.brand ?? machine.name)}
          </div>
        </div>
        <div className="item-inner">
          <div className="item-title-row">
            <div className="item-title">{machine.name}</div>
            {machine.distanceKm != null && (
              <div className="item-after op-dist">{formatKm(machine.distanceKm)}</div>
            )}
          </div>
          <div className="item-subtitle op-sub">{subtitle}</div>
          <div className="op-row-meta">
            <StatusBadge activity={machine.activity} />
            <span className="op-meta">{formatPercent(machine.insights.fuelLevel)} fuel</span>
            <span className="op-meta">{formatHours(machine.insights.cumulativeOperatingHours)}</span>
          </div>
        </div>
      </a>
    </li>
  );
}
