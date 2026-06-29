import { Popup, Page, Navbar, NavLeft, NavTitle, Link } from 'framework7-react';
import InspectionFormRunner from './InspectionFormRunner';
import InspectionChatRunner from './InspectionChatRunner';
import { Thumb } from './ciShared';
import type { InspectionTemplate, Outcome } from '../lib/inspectionTypes';
import type { FleetMachine } from '../types';

export default function InspectionPopup({
  template,
  machine,
  onClose,
  onComplete,
}: {
  template: InspectionTemplate | null;
  machine: FleetMachine | null;
  /** Dismissed without finishing (back / swipe / X). */
  onClose: () => void;
  /** Inspection finished — outcome derived/returned. */
  onComplete: (outcome: Outcome) => void;
}) {
  const opened = !!template && !!machine;
  const isAi = template?.kind === 'intent';

  return (
    <Popup
      className={`op-insp-popup${isAi ? ' op-insp-popup-chat' : ''}`}
      push
      opened={opened}
      onPopupClosed={onClose}
    >
      <Page className="op-insp-page">
        <Navbar className="op-insp-navbar">
          <NavLeft>
            <Link popupClose iconF7="xmark" />
          </NavLeft>
          <NavTitle>{isAi ? 'AI inspection' : 'Inspection'}</NavTitle>
        </Navbar>

        {template && machine && (
          <>
            <div className="op-insp-machine">
              <Thumb machine={machine} />
              <div className="op-insp-machine-info">
                <div className="op-insp-machine-name">{machine.name}</div>
                <div className="op-insp-machine-sub">
                  {[machine.brand, machine.model, machine.assetType].filter(Boolean).join(' · ')}
                </div>
              </div>
              {isAi && <span className="op-ci-ai-badge">AI</span>}
            </div>

            {isAi ? (
              <InspectionChatRunner template={template} machine={machine} onDone={onComplete} />
            ) : (
              <InspectionFormRunner template={template} machine={machine} onDone={onComplete} />
            )}
          </>
        )}
      </Page>
    </Popup>
  );
}
