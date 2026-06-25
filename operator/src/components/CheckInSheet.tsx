import { useEffect, useState } from 'react';
import { Sheet, Icon } from 'framework7-react';
import type { FleetMachine } from '../types';
import StatusBadge from './StatusBadge';
import { Thumb } from './ciShared';
import { useCheckIn } from '../lib/useCheckIn';

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

export default function CheckInSheet({
  machine,
  onClose,
}: {
  machine: FleetMachine | null;
  onClose: () => void;
}) {
  const { checkInTo } = useCheckIn();
  const opened = !!machine;
  const [expanded, setExpanded] = useState(false);

  // Always start collapsed when a (new) asset opens the sheet.
  useEffect(() => {
    if (!opened) setExpanded(false);
  }, [opened, machine?.assetId]);

  const doCheckIn = () => {
    if (!machine) return;
    checkInTo(machine);
    onClose();
  };

  // 1st tap reveals the inspections; once expanded, "Check in" checks in.
  const onPrimary = () => (expanded ? doCheckIn() : setExpanded(true));

  return (
    <Sheet
      className="op-checkin-sheet"
      style={{ height: 'auto' }}
      backdrop={false}
      closeByOutsideClick
      swipeToClose
      opened={opened}
      onSheetClosed={() => {
        setExpanded(false);
        onClose();
      }}
    >
      <div className="op-ci-card">
        <div className="op-ci-grip" />
        {machine && (
          <>
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

            <button
              type="button"
              className="op-ci-btn op-ci-btn-fill op-ci-primary"
              onClick={onPrimary}
            >
              Check in
            </button>

            {expanded && (
              <div className="op-ci-inspections">
                <div className="op-ci-extra-title">Inspect before check-in</div>
                {INSPECTIONS.map((i) => (
                  <button
                    key={i.id}
                    type="button"
                    className={`op-ci-insp${i.kind === 'ai' ? ' op-ci-insp-ai' : ''}`}
                    onClick={doCheckIn}
                  >
                    <Icon f7={i.kind === 'ai' ? 'sparkles' : 'checkmark_shield'} />
                    <span className="op-ci-insp-label">{i.label}</span>
                    {i.kind === 'ai' && <span className="op-ci-ai-badge">AI</span>}
                    <Icon f7="chevron_right" className="op-ci-insp-chev" />
                  </button>
                ))}
                <button
                  type="button"
                  className="op-ci-btn op-ci-btn-text op-ci-skip"
                  onClick={doCheckIn}
                >
                  Skip &amp; check in
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}
