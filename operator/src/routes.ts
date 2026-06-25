import Home from './pages/Home';
import Log from './pages/Log';
import LogDetail from './pages/LogDetail';
import Inbox from './pages/Inbox';
import InboxDetail from './pages/InboxDetail';
import Profile from './pages/Profile';
import NotFound from './pages/NotFound';

const routes = [
  { path: '/', component: Home },
  { path: '/log/', component: Log },
  { path: '/log/:id/', component: LogDetail },
  { path: '/inbox/', component: Inbox },
  { path: '/inbox/:id/', component: InboxDetail },
  { path: '/profile/', component: Profile },
  { path: '(.*)', component: NotFound },
];

export default routes;
