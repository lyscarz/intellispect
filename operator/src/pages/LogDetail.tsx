import { Page, Navbar, NavLeft, NavTitle, Link, Block, BlockTitle, List, ListItem } from 'framework7-react';
import { SAMPLE_SESSIONS } from '../lib/sampleData';

export default function LogDetail(props: { f7route?: { params?: { id?: string } } }) {
  const id = props.f7route?.params?.id;
  const s = SAMPLE_SESSIONS.find((x) => x.id === id);

  return (
    <Page name="log-detail">
      <Navbar>
        <NavLeft>
          <Link back iconF7="chevron_left">
            Log
          </Link>
        </NavLeft>
        <NavTitle>{s?.machineName ?? 'Session'}</NavTitle>
      </Navbar>

      {!s ? (
        <Block>Session not found.</Block>
      ) : (
        <>
          <BlockTitle>
            {new Date(s.date).toLocaleString('en-GB', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </BlockTitle>
          <List strongIos outlineIos dividersIos>
            <ListItem title="Machine" after={s.machineName} />
            <ListItem title="Type" after={s.machineType} />
            <ListItem title="Drive" after={`${s.segments.drive} min`} />
            <ListItem title="Idle" after={`${s.segments.idle} min`} />
            <ListItem title="Stopped" after={`${s.segments.stopped} min`} />
          </List>
          <Block>
            <p className="op-muted">
              A richer breakdown (route map, fuel burn, events and utilisation) can be built
              on this screen later.
            </p>
          </Block>
        </>
      )}
    </Page>
  );
}
