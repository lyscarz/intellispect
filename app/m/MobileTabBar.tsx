'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface Tab {
  href: string;
  match: (pathname: string) => boolean;
  label: string;
  icon: (props: { active: boolean }) => JSX.Element;
}

const TABS: Tab[] = [
  {
    href: '/m',
    match: (p) => p === '/m',
    label: 'Check-in',
    icon: CheckInIcon,
  },
  {
    href: '/m/fleet',
    match: (p) => p.startsWith('/m/fleet') || p.startsWith('/m/machine') || p.startsWith('/m/run'),
    label: 'Fleet',
    icon: FleetIcon,
  },
  {
    href: '/m/assistant',
    match: (p) => p.startsWith('/m/assistant'),
    label: 'Assistant',
    icon: AssistantIcon,
  },
  {
    href: '/m/profile',
    match: (p) => p.startsWith('/m/profile') || p.startsWith('/m/invite'),
    label: 'Profile',
    icon: ProfileIcon,
  },
];

export function MobileTabBar() {
  const pathname = usePathname();

  // Hide the tab bar on full-screen flows (runners and the done screen).
  if (
    pathname.startsWith('/m/run/') ||
    pathname.startsWith('/m/run-intent/') ||
    pathname.startsWith('/m/done/')
  ) {
    return null;
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 flex"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Mobile navigation"
    >
      {TABS.map((t) => {
        const active = t.match(pathname);
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium ${
              active ? 'text-brand-700' : 'text-slate-500'
            }`}
            aria-current={active ? 'page' : undefined}
          >
            <Icon active={active} />
            <span>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function CheckInIcon({ active }: { active: boolean }) {
  return (
    <svg
      className={`w-6 h-6 ${active ? 'stroke-brand-700' : 'stroke-slate-500'}`}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={active ? 2.2 : 1.8}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function FleetIcon({ active }: { active: boolean }) {
  return (
    <svg
      className={`w-6 h-6 ${active ? 'stroke-brand-700' : 'stroke-slate-500'}`}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={active ? 2.2 : 1.8}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );
}

function AssistantIcon({ active }: { active: boolean }) {
  return (
    <svg
      className={`w-6 h-6 ${active ? 'stroke-brand-700' : 'stroke-slate-500'}`}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={active ? 2.2 : 1.8}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

function ProfileIcon({ active }: { active: boolean }) {
  return (
    <svg
      className={`w-6 h-6 ${active ? 'stroke-brand-700' : 'stroke-slate-500'}`}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={active ? 2.2 : 1.8}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}
