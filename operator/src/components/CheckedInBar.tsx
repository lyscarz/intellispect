import { f7 } from 'framework7-react';
import { useCheckIn } from '../lib/useCheckIn';
import { Thumb, Elapsed, machineSub } from './ciShared';

/** Persistent "checked in" bar shown above the tabbar in every tab. */
export default function CheckedInBar() {
  const { checkIn, checkOut } = useCheckIn();
  if (!checkIn) return null;

  const { machine, startedAt } = checkIn;
  const sub = machineSub(machine);
  const confirmOut = () =>
    f7.dialog.confirm(`Check out of ${machine.name}?`, 'Check out', checkOut);

  return (
    <div className="op-ci-fixed-bar">
      <Thumb machine={machine} />
      <div className="op-ci-bar-main">
        <div className="op-ci-bar-top">
          <span className="op-ci-checked">
            <span className="op-ci-live-dot" />
            Checked in
          </span>
          <Elapsed startedAt={startedAt} />
        </div>
        <div className="op-ci-bar-name">
          {machine.name}
          {sub && <span className="op-ci-bar-sub"> ({sub})</span>}
        </div>
      </div>
      <button type="button" className="op-ci-checkout-btn" onClick={confirmOut}>
        Check out
      </button>
    </div>
  );
}
