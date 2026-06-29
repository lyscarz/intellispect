import { useEffect, useState } from 'react';
import { Sheet, Icon, Preloader } from 'framework7-react';
import type { FleetMachine } from '../types';
import type { InspectionTemplate } from '../lib/inspectionTypes';
import StatusBadge from './StatusBadge';
import { Thumb } from './ciShared';
import { useCheckIn } from '../lib/useCheckIn';
import { templatesForMachine } from '../lib/inspections';

export default function CheckInSheet({
  machine,
  onClose,
  onSelectInspection,
}: {
  machine: FleetMachine | null;
  onClose: () => void;
  onSelectInspection: (template: InspectionTemplate) => void;
}) {
  const { checkInTo } = useCheckIn();
  const opened = !!machine;
  const [expanded, setExpanded] = useState(false);

  const [templates, setTemplates] = useState<InspectionTemplate[] | null>(null); // null = loading
  const [tplError, setTplError] = useState<string | null>(null);

  // Always start collapsed when a (new) asset opens the sheet.
  useEffect(() => {
    if (!opened) setExpanded(false);
  }, [opened, machine?.assetId]);

  // Fetch the machine's assigned templates the first time the sheet expands.
  useEffect(() => {
    if (!expanded || !machine) return;
    let cancelled = false;
    setTemplates(null);
    setTplError(null);
    templatesForMachine(machine)
      .then((t) => {
        if (!cancelled) setTemplates(t);
      })
      .catch((e) => {
        if (!cancelled) {
          setTemplates([]);
          setTplError((e as Error).message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [expanded, machine?.assetId]);

  const doCheckIn = () => {
    if (!machine) return;
    checkInTo(machine);
    onClose();
  };

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

            {!expanded ? (
              <button
                type="button"
                className="op-ci-btn op-ci-btn-fill op-ci-primary"
                onClick={() => setExpanded(true)}
              >
                Check in
              </button>
            ) : (
              <div className="op-ci-inspections">
                <div className="op-ci-extra-title">Inspect before check-in</div>

                {templates === null ? (
                  <div className="op-ci-tpl-loading">
                    <Preloader size={22} />
                    <span>Loading inspections…</span>
                  </div>
                ) : templates.length === 0 ? (
                  <div className="op-ci-tpl-empty">
                    {tplError
                      ? 'Could not load inspections.'
                      : 'No inspections assigned to this machine.'}
                  </div>
                ) : (
                  templates.map((t) => {
                    const ai = t.kind === 'intent';
                    return (
                      <button
                        key={t.id}
                        type="button"
                        className={`op-ci-insp${ai ? ' op-ci-insp-ai' : ''}`}
                        onClick={() => onSelectInspection(t)}
                      >
                        <Icon f7={ai ? 'sparkles' : 'checkmark_shield'} />
                        <span className="op-ci-insp-label">{t.name}</span>
                        {ai && <span className="op-ci-ai-badge">AI</span>}
                        <Icon f7="chevron_right" className="op-ci-insp-chev" />
                      </button>
                    );
                  })
                )}

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
