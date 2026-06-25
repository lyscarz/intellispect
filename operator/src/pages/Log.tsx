import { Page, Navbar, NavTitle, BlockTitle, List } from 'framework7-react';
import { SAMPLE_SESSIONS } from '../lib/sampleData';
import { brandColors, assetInitials } from '../lib/format';

function fmtDur(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}
function pct(v: number, total: number) {
  return total ? Math.round((v / total) * 100) : 0;
}

export default function Log() {
  return (
    <Page name="log">
      <Navbar large>
        <NavTitle large>Log</NavTitle>
      </Navbar>

      <BlockTitle>My sessions</BlockTitle>
      <List dividersIos mediaList strongIos outlineIos className="op-machine-list">
        {SAMPLE_SESSIONS.map((s) => {
          const total = s.segments.drive + s.segments.idle + s.segments.stopped;
          const [bg, fg] = brandColors(s.brand ?? s.machineName);
          return (
            <li key={s.id}>
              <a className="item-link item-content" href={`/log/${s.id}/`}>
                <div className="item-media">
                  <div className="op-thumb" style={{ background: bg, color: fg }}>
                    {assetInitials(s.brand ?? s.machineName)}
                  </div>
                </div>
                <div className="item-inner">
                  <div className="item-title-row">
                    <div className="item-title">{s.machineName}</div>
                    <div className="item-after">{fmtDur(total)}</div>
                  </div>
                  <div className="item-subtitle op-sub">
                    {new Date(s.date).toLocaleDateString('en-GB', {
                      weekday: 'short',
                      day: '2-digit',
                      month: 'short',
                    })}{' '}
                    · {s.machineType}
                  </div>
                  <div className="op-stack">
                    <span className="op-stack-drive" style={{ width: `${pct(s.segments.drive, total)}%` }} />
                    <span className="op-stack-idle" style={{ width: `${pct(s.segments.idle, total)}%` }} />
                    <span className="op-stack-stopped" style={{ width: `${pct(s.segments.stopped, total)}%` }} />
                  </div>
                  <div className="op-stack-legend">
                    <span><i className="op-dot op-dot-drive" />Drive {fmtDur(s.segments.drive)}</span>
                    <span><i className="op-dot op-dot-idle" />Idle {fmtDur(s.segments.idle)}</span>
                    <span><i className="op-dot op-dot-stopped" />Stopped {fmtDur(s.segments.stopped)}</span>
                  </div>
                </div>
              </a>
            </li>
          );
        })}
      </List>
    </Page>
  );
}
