import { useEffect, useState } from 'react';
import {
  App as F7App,
  View,
  Views,
  Toolbar,
  ToolbarPane,
  Link,
  Panel,
  Icon,
  Block,
  Preloader,
  LoginScreen,
  Page,
  f7,
  f7ready,
} from 'framework7-react';
import Framework7 from 'framework7/lite-bundle';
import Framework7React from 'framework7-react';

import routes from './routes';
import { AuthProvider, useAuth } from './lib/useAuth';
import { resolveInitialDark } from './lib/theme';
import Login from './pages/Login';
import ReloadPrompt from './components/ReloadPrompt';

Framework7.use(Framework7React);

// At/above this width the bottom tabbar is replaced by a left sidebar (iPad
// portrait = 768). Kept in sync with the media query in app.css.
const SIDEBAR_BREAKPOINT = 768;

interface TabDef {
  id: string;
  view: string;
  icon: string;
  text: string;
}

const TABS: TabDef[] = [
  { id: 'home', view: 'view-home', icon: 'map_fill', text: 'Home' },
  { id: 'log', view: 'view-log', icon: 'square_list_fill', text: 'Log' },
  { id: 'inbox', view: 'view-inbox', icon: 'tray_fill', text: 'Inbox' },
  { id: 'profile', view: 'view-profile', icon: 'person_crop_circle_fill', text: 'Profile' },
];

const f7params = {
  name: 'Operator',
  // Force the iOS theme on all platforms for a consistent look.
  theme: 'ios' as const,
  darkMode: resolveInitialDark(),
  routes,
  view: {
    // browserHistory OFF: with multiple tabbed views, v9 matches the initial
    // URL into every view on load. Disabling it lets each <View tab> load its
    // own `url`. In-app stack navigation + iOS swipe-back still work.
    browserHistory: false,
    iosSwipeBack: true,
    mdSwipeBack: false,
  },
  navbar: {
    iosCenterTitle: true,
    mdCenterTitle: false,
  },
  touch: {
    tapHold: true,
  },
};

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}

function Shell() {
  const { session, loading } = useAuth();
  const loggedIn = !!session;

  // Mirror F7's active tab into React so the sidebar can highlight correctly.
  const [activeTab, setActiveTab] = useState<string>('home');

  useEffect(() => {
    let handler: ((tabEl: HTMLElement) => void) | undefined;
    f7ready((app) => {
      handler = (tabEl: HTMLElement) => {
        const tab = TABS.find((t) => t.view === tabEl?.id);
        if (tab) setActiveTab(tab.id);
      };
      app.on('tabShow', handler);
    });
    return () => {
      if (handler && f7) f7.off('tabShow', handler);
    };
  }, []);

  return (
    <F7App {...f7params}>
      <ReloadPrompt />

      {/* Tablet/desktop sidebar — static at/above the breakpoint, hidden on phones. */}
      {loggedIn && (
        <Panel left reveal visibleBreakpoint={SIDEBAR_BREAKPOINT} className="sidebar-panel">
          <div className="sidebar-inner">
            <div className="sidebar-brand">
              <span className="sidebar-logo">OP</span>
              Operator
            </div>
            <nav className="sidebar-nav">
              {TABS.map((t) => (
                <Link
                  key={t.id}
                  tabLink={`#${t.view}`}
                  className={`sidebar-item${activeTab === t.id ? ' active' : ''}`}
                >
                  <Icon f7={t.icon} />
                  <span>{t.text}</span>
                </Link>
              ))}
            </nav>
          </div>
        </Panel>
      )}

      {/* Remount views (and refetch) when the signed-in user changes. */}
      <Views key={session?.user?.id ?? 'anon'} tabs className="safe-areas">
        <Toolbar tabbar icons bottom className="tabbar-phone">
          <ToolbarPane>
            {TABS.map((t, i) => (
              <Link
                key={t.id}
                tabLink={`#${t.view}`}
                tabLinkActive={i === 0}
                iconF7={t.icon}
                text={t.text}
              />
            ))}
          </ToolbarPane>
        </Toolbar>

        <View id="view-home" main tab tabActive url="/" />
        <View id="view-log" tab url="/log/" />
        <View id="view-inbox" tab url="/inbox/" />
        <View id="view-profile" tab url="/profile/" />
      </Views>

      {/* Splash while we resolve the initial session. */}
      {loading && (
        <LoginScreen opened>
          <Page loginScreen>
            <Block style={{ textAlign: 'center', marginTop: '40vh' }}>
              <Preloader size={32} />
            </Block>
          </Page>
        </LoginScreen>
      )}

      {/* Login gate. */}
      {!loading && <Login opened={!loggedIn} />}
    </F7App>
  );
}
