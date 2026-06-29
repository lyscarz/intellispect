import { useEffect, useState } from 'react';
import {
  Page,
  Navbar,
  NavLeft,
  NavTitle,
  Link,
  Block,
  BlockTitle,
  List,
  ListItem,
  Preloader,
} from 'framework7-react';
import { SAMPLE_SESSIONS } from '../lib/sampleData';
import { getSession } from '../lib/sessions';

interface Detail {
  machineName: string;
  machineType: string | null;
  started: string; // ISO
  ended: string | null; // ISO
  segments?: { drive: number; idle: number; stopped: number };
}

function fmtDur(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

export default function LogDetail(props: { f7route?: { params?: { id?: string } } }) {
  const id = props.f7route?.params?.id ?? '';
  const sample = SAMPLE_SESSIONS.find((x) => x.id === id);
  const [detail, setDetail] = useState<Detail | null | undefined>(undefined); // undefined = loading

  useEffect(() => {
    if (sample) {
      setDetail({
        machineName: sample.machineName,
        machineType: sample.machineType,
        started: sample.date,
        ended: null,
        segments: sample.segments,
      });
      return;
    }
    let cancelled = false;
    getSession(id).then((row) => {
      if (cancelled) return;
      setDetail(
        row
          ? {
              machineName: row.machine_name,
              machineType: row.machine_type,
              started: row.started_at,
              ended: row.ended_at,
            }
          : null
      );
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const durationMin =
    detail?.ended != null
      ? Math.max(1, Math.round((new Date(detail.ended).getTime() - new Date(detail.started).getTime()) / 60000))
      : null;

  return (
    <Page name="log-detail">
      <Navbar>
        <NavLeft>
          <Link back iconF7="chevron_left">
            Log
          </Link>
        </NavLeft>
        <NavTitle>{detail?.machineName ?? 'Session'}</NavTitle>
      </Navbar>

      {detail === undefined ? (
        <Block style={{ textAlign: 'center', padding: '24px 0' }}>
          <Preloader />
        </Block>
      ) : detail === null ? (
        <Block>Session not found.</Block>
      ) : (
        <>
          <BlockTitle>
            {new Date(detail.started).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
          </BlockTitle>
          <List strongIos outlineIos dividersIos>
            <ListItem title="Machine" after={detail.machineName} />
            {detail.machineType && <ListItem title="Type" after={detail.machineType} />}
            {detail.ended && (
              <ListItem
                title="Checked out"
                after={new Date(detail.ended).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
              />
            )}
            {durationMin != null && <ListItem title="Duration" after={fmtDur(durationMin)} />}
            {detail.segments && (
              <>
                <ListItem title="Drive" after={`${detail.segments.drive} min`} />
                <ListItem title="Idle" after={`${detail.segments.idle} min`} />
                <ListItem title="Stopped" after={`${detail.segments.stopped} min`} />
              </>
            )}
          </List>
          <Block>
            <p className="op-muted">
              A richer breakdown (route map, fuel burn, events and utilisation) can be built on this
              screen later.
            </p>
          </Block>
        </>
      )}
    </Page>
  );
}
