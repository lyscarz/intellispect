import { getSessionContext } from '@/lib/getSessionContext';
import { AppShell } from './AppShell';

export const dynamic = 'force-dynamic';

/**
 * (app) group layout. Keeps the auth side-effect — `getSessionContext()`
 * redirects unauthenticated users to /login and auto-creates the default
 * account + fleet on first visit. All UI chrome lives in `AppShell`.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getSessionContext();
  return (
    <AppShell
      user={{
        email: ctx.email,
        role: ctx.role,
        accountId: ctx.accountId,
        accountName: ctx.accountName,
        memberships: ctx.memberships,
      }}
    >
      {children}
    </AppShell>
  );
}
