import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ServiceWorkerRegistration } from './ServiceWorkerRegistration';

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
  // We do NOT call getSessionContext() — that auto-creates an account on first
  // visit, which is wrong for the operator app. We just check the Supabase
  // session exists and redirect to /login?next=/m if not.
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/m');

  return (
    <div
      className="min-h-screen bg-slate-50 text-slate-900"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <ServiceWorkerRegistration />
      {children}
    </div>
  );
}
