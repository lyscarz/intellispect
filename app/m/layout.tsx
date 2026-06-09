import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import { ServiceWorkerRegistration } from './ServiceWorkerRegistration';

export const metadata: Metadata = {
  title: 'Yo Inspect',
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

export default function MobileLayout({ children }: { children: ReactNode }) {
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
