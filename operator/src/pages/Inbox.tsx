import { Page, Navbar, NavTitle, NavRight, List, Icon } from 'framework7-react';
import { SAMPLE_INBOX } from '../lib/sampleData';
import type { InboxKind } from '../types';

export const KIND_META: Record<
  InboxKind,
  { icon: string; label: string; color: string }
> = {
  license_request: { icon: 'doc_text_fill', label: 'License', color: '#2563eb' },
  health_report: { icon: 'heart_fill', label: 'Health', color: '#dc2626' },
  permission_grant: { icon: 'lock_shield_fill', label: 'Access', color: '#7c3aed' },
  question: { icon: 'questionmark_circle_fill', label: 'Question', color: '#0891b2' },
  message: { icon: 'bubble_left_fill', label: 'Message', color: '#475569' },
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h`;
  return `${Math.round(hr / 24)}d`;
}

export default function Inbox() {
  const unread = SAMPLE_INBOX.filter((m) => m.unread).length;

  return (
    <Page name="inbox">
      <Navbar>
        <NavTitle>Inbox</NavTitle>
        <NavRight>{unread > 0 && <span className="op-unread-count">{unread}</span>}</NavRight>
      </Navbar>

      <List dividersIos mediaList strongIos outlineIos className="op-machine-list">
        {SAMPLE_INBOX.map((m) => {
          const meta = KIND_META[m.kind];
          return (
            <li key={m.id}>
              <a className="item-link item-content" href={`/inbox/${m.id}/`}>
                <div className="item-media">
                  <div className="op-inbox-icon" style={{ background: meta.color }}>
                    <Icon f7={meta.icon} />
                  </div>
                </div>
                <div className="item-inner">
                  <div className="item-title-row">
                    <div className="item-title">
                      {m.unread && <span className="op-unread-dot" />}
                      {m.title}
                    </div>
                    <div className="item-after">{timeAgo(m.time)}</div>
                  </div>
                  <div className="item-subtitle op-sub">
                    {m.from} · {m.fromRole}
                  </div>
                  <div className="item-text">{m.preview}</div>
                </div>
              </a>
            </li>
          );
        })}
      </List>
    </Page>
  );
}
