import { useEffect, useState } from 'react';
import { Page, Navbar, NavTitle, BlockTitle, List, Block, Preloader } from 'framework7-react';
import { SAMPLE_SESSIONS } from '../lib/sampleData';
import { listMySessions } from '../lib/sessions';
import { brandColors, assetInitials } from '../lib/format';
import { useCheckIn } from '../lib/useCheckIn';

interface LogRow {
  id: string;
  machineName: string;
  machineType: string | null;
  brand: string | null;
  date: string; // ISO
  totalMin: number;
  segments?: { drive: number; idle: number; stopped: number };
}

function fmtDur(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}
function pct(v: number, total: number) {
  return total ? Math.round((v / total) * 100) : 0;
}

export default function Log() {
  const [rows, setRows] = useState<LogRow[] | null>(null); // null = loading
  const [live, setLive] = useState(false);
  const { sessionsVersion } = useCheckIn();

  useEffect(() => {
    let cancelled = false;
    listMySessions().then(({ rows, live }) => {
      if (cancelled) return;
      if (live && rows.length) {
        setRows(
          rows.map((r) => ({
            id: r.id,
            machineName: r.machine_name,
            machineType: r.machine_type,
            brand: r.machine_brand,
            date: r.started_at,
            totalMin: Math.max(
              1,
              Math.round((new Date(r.ended_at).getTime() - new Date(r.started_at).getTime()) / 60000)
            ),
          }))
        );
        setLive(true);
      } else {
        setRows(
          SAMPLE_SESSIONS.map((s) => ({
            id: s.id,
            machineName: s.machineName,
            machineType: s.machineType,
            brand: s.brand,
            date: s.date,
            totalMin: s.segments.drive + s.segments.idle + s.segments.stopped,
            segments: s.segments,
          }))
        );
        setLive(live); // false → show the sample banner
      }
    });
    return () => {
      cancelled = true;
    };
  }, [sessionsVersion]);

  return (
    <Page name="log">
      <Navbar>
        <NavTitle>Log</NavTitle>
      </Navbar>

      <BlockTitle>My sessions</BlockTitle>

      {rows === null ? (
        <Block style={{ textAlign: 'center', padding: '24px 0' }}>
          <Preloader />
        </Block>
      ) : (
        <>
          {!live && (
            <Block className="op-sample-banner">
              Sample sessions — your real check-ins will appear here.
            </Block>
          )}
          {rows.length === 0 ? (
            <Block className="op-muted">No sessions yet. Check in to a machine to start logging.</Block>
          ) : (
            <List dividersIos mediaList strongIos outlineIos className="op-machine-list">
              {rows.map((s) => {
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
                          <div className="item-after">{fmtDur(s.totalMin)}</div>
                        </div>
                        <div className="item-subtitle op-sub">
                          {new Date(s.date).toLocaleDateString('en-GB', {
                            weekday: 'short',
                            day: '2-digit',
                            month: 'short',
                          })}
                          {s.machineType ? ` · ${s.machineType}` : ''}
                        </div>
                        {s.segments ? (
                          <>
                            <div className="op-stack">
                              <span className="op-stack-drive" style={{ width: `${pct(s.segments.drive, s.totalMin)}%` }} />
                              <span className="op-stack-idle" style={{ width: `${pct(s.segments.idle, s.totalMin)}%` }} />
                              <span className="op-stack-stopped" style={{ width: `${pct(s.segments.stopped, s.totalMin)}%` }} />
                            </div>
                            <div className="op-stack-legend">
                              <span><i className="op-dot op-dot-drive" />Drive {fmtDur(s.segments.drive)}</span>
                              <span><i className="op-dot op-dot-idle" />Idle {fmtDur(s.segments.idle)}</span>
                              <span><i className="op-dot op-dot-stopped" />Stopped {fmtDur(s.segments.stopped)}</span>
                            </div>
                          </>
                        ) : (
                          <div className="op-stack-legend">
                            <span><i className="op-dot op-dot-drive" />Checked in for {fmtDur(s.totalMin)}</span>
                          </div>
                        )}
                      </div>
                    </a>
                  </li>
                );
              })}
            </List>
          )}
        </>
      )}
    </Page>
  );
}
