import {
  Page,
  Navbar,
  NavLeft,
  NavTitle,
  Link,
  Block,
  BlockTitle,
  Button,
  Icon,
  f7,
} from 'framework7-react';
import { SAMPLE_INBOX } from '../lib/sampleData';
import { KIND_META } from './Inbox';

export default function InboxDetail(props: { f7route?: { params?: { id?: string } } }) {
  const id = props.f7route?.params?.id;
  const m = SAMPLE_INBOX.find((x) => x.id === id);

  const act = (verb: string) =>
    f7.dialog.alert(`"${verb}" is a placeholder in this prototype.`, m?.title ?? 'Action');

  return (
    <Page name="inbox-detail">
      <Navbar>
        <NavLeft>
          <Link back iconF7="chevron_left">
            Inbox
          </Link>
        </NavLeft>
        <NavTitle>{KIND_META[m?.kind ?? 'message'].label}</NavTitle>
      </Navbar>

      {!m ? (
        <Block>Message not found.</Block>
      ) : (
        <>
          <div className="op-msg-head">
            <div className="op-inbox-icon op-inbox-icon-lg" style={{ background: KIND_META[m.kind].color }}>
              <Icon f7={KIND_META[m.kind].icon} />
            </div>
            <div>
              <div className="op-msg-from">{m.from}</div>
              <div className="op-sub">{m.fromRole}</div>
            </div>
          </div>

          <BlockTitle large>{m.title}</BlockTitle>
          <Block strong inset>
            <p className="op-msg-body">{m.body}</p>
          </Block>

          {m.actionable ? (
            <Block className="op-msg-actions">
              <Button fill large onClick={() => act('Approve')}>
                Approve
              </Button>
              <Button large outline onClick={() => act('Decline')} style={{ marginTop: 8 }}>
                Decline
              </Button>
            </Block>
          ) : (
            <Block>
              <Button large outline onClick={() => act('Reply')}>
                Reply
              </Button>
            </Block>
          )}
        </>
      )}
    </Page>
  );
}
