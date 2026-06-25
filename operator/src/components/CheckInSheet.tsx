import { useEffect, useState } from 'react';
import { Sheet, Icon, f7 } from 'framework7-react';
import type { FleetMachine } from '../types';
import { assetInitials, brandColors } from '../lib/format';
import StatusBadge from './StatusBadge';

export interface CheckInState {
  machine: FleetMachine;
  startedAt: number;
}

const SUMMARY_SEL = '.op-summary-sheet';

interface Inspection {
  id: string;
  label: string;
  kind: 'ai' | 'normal';
}
const INSPECTIONS: Inspection[] = [
  { id: 'ai', label: 'AI inspection', kind: 'ai' },
  { id: 'daily', label: 'Daily check', kind: 'normal' },
  { id: 'preop', label: 'Pre-operation check', kind: 'normal' },
];

interface Props {
  machine: FleetMachine | null;
  checkIn: CheckInState | null;
  onCheckIn: (m: FleetMachine) => void;
  onCheckOut: () => void;
  onClose: () => void;
}

export default function CheckInSheet({ machine, checkIn, onCheckIn, onCheckOut, onClose }: Props) {
  const summaryOpen = !!machine && !checkIn;
  const [expanded, setExpanded] = useState(false);

  // Collapse back to the step whenever the summary opens/closes.
  useEffect(() => {
    setExpanded(false);
  }, [summaryOpen]);

  const expand = () => {
    f7.sheet.get(SUMMARY_SEL)?.stepOpen?.();
    setExpanded(true);
  };

  const confirmCheckOut = () => {
    if (!checkIn) return;
    f7.dialog.confirm(`Check out of ${checkIn.machine.name}?`, 'Check out', onCheckOut);
  };

  return (
    <>
      {/* Pre-check-in: swipe-to-step sheet (summary → inspections). */}
      <Sheet
        className={`op-checkin-sheet op-summary-sheet${expanded ? ' op-ci-expanded' : ''}`}
        style={{ height: 'auto' }}
        swipeToStep
        backdrop={false}
        opened={summaryOpen}
        onSheetOpened={(sheet) =>
          sheet.on('stepProgress', (...a: unknown[]) => setExpanded((a[1] as number) > 0.5))
        }
        onSheetClosed={() => {
          setExpanded(false);
          if (!checkIn) onClose();
        }}
      >
        {machine && <Summary machine={machine} onExpand={expand} onCheckIn={onCheckIn} />}
      </Sheet>

      {/* Checked-in: minimised bar above the tabbar. Tap to check out. */}
      {checkIn && (
        <div className="op-ci-fixed-bar" onClick={confirmCheckOut} role="button">
          <Thumb machine={checkIn.machine} />
          <div className="op-ci-bar-main">
            <div className="op-ci-bar-top">
              <span className="op-ci-checked">
                <span className="op-ci-live-dot" />
                Checked in
              </span>
              <Elapsed startedAt={checkIn.startedAt} />
            </div>
            <div className="op-ci-bar-name">
              {checkIn.machine.name}
              {barSub(checkIn.machine) && <span className="op-ci-bar-sub"> ({barSub(checkIn.machine)})</span>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function barSub(m: FleetMachine) {
  return [m.brand, m.model, m.assetType].filter(Boolean).join(', ');
}

function Summary({
  machine,
  onExpand,
  onCheckIn,
}: {
  machine: FleetMachine;
  onExpand: () => void;
  onCheckIn: (m: FleetMachine) => void;
}) {
  return (
    <>
      <div className="sheet-modal-swipe-step op-ci-step">
        <div className="op-ci-card op-ci-card-top">
          <div className="op-ci-grip" />
          <div className="op-ci-summary">
            <Thumb machine={machine} lg />
            <div className="op-ci-summary-info">
              <div className="op-ci-name">{machine.name}</div>
              <div className="op-ci-meta">
                {[machine.brand, machine.model].filter(Boolean).join(' · ') || '—'}
              </div>
              <div className="op-ci-type">{machine.assetType}</div>
              <div className="op-ci-status">
                <StatusBadge activity={machine.activity} />
              </div>
            </div>
          </div>
          <button type="button" className="op-ci-btn op-ci-btn-fill op-ci-primary" onClick={onExpand}>
            Check in
          </button>
        </div>
      </div>

      <div className="op-ci-extra">
        <div className="op-ci-card op-ci-card-bottom">
          <div className="op-ci-extra-title">Inspect before check-in</div>
          {INSPECTIONS.map((i) => (
            <button
              key={i.id}
              type="button"
              className={`op-ci-insp${i.kind === 'ai' ? ' op-ci-insp-ai' : ''}`}
              onClick={() => onCheckIn(machine)}
            >
              <Icon f7={i.kind === 'ai' ? 'sparkles' : 'checkmark_shield'} />
              <span className="op-ci-insp-label">{i.label}</span>
              {i.kind === 'ai' && <span className="op-ci-ai-badge">AI</span>}
              <Icon f7="chevron_right" className="op-ci-insp-chev" />
            </button>
          ))}
          <button type="button" className="op-ci-btn op-ci-btn-text op-ci-skip" onClick={() => onCheckIn(machine)}>
            Skip &amp; check in
          </button>
        </div>
      </div>
    </>
  );
}

function Thumb({ machine, lg }: { machine: FleetMachine; lg?: boolean }) {
  const cls = `op-ci-thumb${lg ? ' op-ci-thumb-lg' : ''}`;
  if (machine.imageUrl) return <img className={cls} src={machine.imageUrl} alt="" />;
  const [bg, fg] = brandColors(machine.brand ?? machine.name);
  return (
    <div className={cls} style={{ background: bg, color: fg }}>
      {assetInitials(machine.brand ?? machine.name)}
    </div>
  );
}

function Elapsed({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const total = Math.max(0, Math.floor((now - startedAt) / 1000));
  const hh = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  const ss = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <span className="op-ci-timer">
      {hh > 0 ? `${pad(hh)}:` : ''}
      {pad(mm)}:{pad(ss)}
    </span>
  );
}
