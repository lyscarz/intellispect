import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ServiceWorkerRegistration } from './ServiceWorkerRegistration';
import { MobileTabBar } from './MobileTabBar';
import { CheckInBar } from './CheckInBar';

export const metadata: Metadata = {
  title: 'IntelliCheck',
  description: 'Run inspections on your fleet from the field.',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export const dynamic = 'force-dynamic';

export default async function MobileLayout({ children }: { children: ReactNode }) {
  // Auth gate: /m is at the root (not under (app)/), so we re-enforce here.
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/m');

  return (
    <div
      className="min-h-screen bg-slate-50 text-slate-900 flex flex-col"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <ServiceWorkerRegistration />
      {/* Content fills the screen; the tab bar + (optional) check-in bar
          live below as fixed elements. We reserve their height via padding
          on the scrollable area. The tab bar is ~56px + safe-area-inset;
          the check-in bar is ~48px when present. Without precise math we
          give ~110px to be safe and let the bars overlay if the page is
          short. */}
      <main
        className="flex-1"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 110px)' }}
      >
        {children}
      </main>
      <CheckInBar />
      <MobileTabBar />
    </div>
  );
}
