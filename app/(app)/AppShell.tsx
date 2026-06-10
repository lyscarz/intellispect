'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { AccountSwitcher } from './AccountSwitcher';

/**
 * App shell: persistent left sidebar (nav) + top bar (page title + account
 * chip + email). On screens below `lg` (1024px) the sidebar collapses behind
 * a hamburger button and opens as a drawer with a backdrop.
 *
 * Owns:
 *  - drawer open/close state
 *  - pathname-driven active highlight on sidebar items
 *  - pathname-driven page title in the top bar
 *  - body-scroll lock + Esc-to-close + close-on-route-change for the drawer
 *
 * Used by `app/(app)/layout.tsx` to wrap every (app)-group page.
 */

// Inline SVGs in the codebase style (no icon library). One per nav item.
const InventoryIcon = ({ className = '' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
);
const SiteIcon = ({ className = '' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const InspectionIcon = ({ className = '' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
  </svg>
);
const InspectionHistoryIcon = ({ className = '' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l4-4h10a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 11h8M8 15h5" />
  </svg>
);
const SettingsIcon = ({ className = '' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const HamburgerIcon = ({ className = '' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);
const CloseIcon = ({ className = '' }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

type IconCmp = (p: { className?: string }) => JSX.Element;
interface NavItem {
  label: string;
  href: string;
  match: RegExp;
  icon: IconCmp;
}

// Top section of the sidebar — primary navigation.
// "Inspections" is the single entry point; the template builder is reached
// from a CTA on that page (see /inspection-history) rather than the sidebar.
const NAV: NavItem[] = [
  { label: 'Inventory', href: '/fleet', match: /^\/fleet(\/|$)/, icon: InventoryIcon },
  { label: 'Sites', href: '/sites', match: /^\/sites(\/|$)/, icon: SiteIcon },
  { label: 'Inspections', href: '/inspection-history', match: /^\/inspection-history(\/|$)/, icon: InspectionHistoryIcon },
];

// Routes hidden from the `operator` role. Empty for now — the only entries
// here once were admin-only, but the routes they pointed at have been moved
// behind CTAs on shared pages.
const ADMIN_ONLY_HREFS = new Set<string>();

// Pushed to the bottom of the nav area, above the user footer.
const SETTINGS_NAV: NavItem[] = [
  { label: 'Settings', href: '/settings', match: /^\/settings(\/|$)/, icon: SettingsIcon },
];

function roleLabel(role: string): string {
  // Human-friendly version of the DB enum for the user-footer chip.
  switch (role) {
    case 'account_admin':
      return 'Account admin';
    case 'admin_user':
      return 'Admin';
    case 'operator':
      return 'Operator';
    default:
      return role;
  }
}

export function AppShell({
  user,
  children,
}: {
  user: {
    email: string;
    role: string;
    accountId: string;
    accountName: string;
    memberships: Array<{
      accountId: string;
      accountName: string;
      role: 'account_admin' | 'admin_user' | 'operator';
    }>;
  };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Auto-close drawer whenever the route changes — covers nav-link clicks
  // without each link needing its own onClick handler.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Body scroll lock + Esc-to-close, mobile drawer only.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [drawerOpen]);

  return (
    // h-screen + overflow-hidden locks total height to viewport — the only
    // scroll container is <main> below, so the sidebar stays put while
    // content scrolls.
    <div className="h-screen flex bg-slate-50 overflow-hidden">
      {/* Backdrop — mobile only, click to dismiss */}
      {drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      )}

      {/* Sidebar — fixed on mobile (drawer), static + full-height on desktop. */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-60 bg-white border-r border-slate-200
                    flex flex-col transition-transform duration-200
                    ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}
                    lg:static lg:translate-x-0 lg:h-screen`}
        aria-label="Primary navigation"
      >
        {/* Brand + (mobile) close */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-slate-200">
          <Link href="/fleet" className="flex items-center">
            <Image
              src="/intellicheck-logo.png"
              alt="IntelliCheck"
              width={500}
              height={120}
              priority
              className="h-8 w-auto object-contain"
            />
          </Link>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="lg:hidden p-1.5 text-slate-500 hover:text-slate-900 rounded-md hover:bg-slate-100"
            aria-label="Close menu"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Main nav — flex-1 + overflow-y-auto so it scrolls if the top
            section ever overflows. Settings + user footer below are pinned. */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-1">
          {NAV.filter((item) => user.role !== 'operator' || !ADMIN_ONLY_HREFS.has(item.href)).map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}
        </nav>

        {/* Settings — pinned, always visible regardless of nav scroll. */}
        <div className="border-t border-slate-200 px-3 py-2 flex flex-col gap-1">
          {SETTINGS_NAV.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}
        </div>

        {/* User footer — pinned. Email + role chip, then Sign out. */}
        <div className="border-t border-slate-200 p-3">
          <div className="rounded-lg bg-slate-50 px-3 py-2 mb-2 min-w-0">
            <p className="text-xs font-medium text-slate-900 truncate" title={user.email}>
              {user.email}
            </p>
            <p className="text-[10px] uppercase tracking-wide text-slate-500 mt-0.5">
              {roleLabel(user.role)}
            </p>
          </div>
          <form action="/auth/signout" method="POST">
            <button
              type="submit"
              className="w-full text-left text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 px-3 py-2 rounded-md inline-flex items-center gap-2"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.75}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main column — min-h-0 lets <main> shrink so its overflow-y-auto
          actually triggers a scroll inside the column rather than the page. */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Top bar: hamburger (mobile) + account chip + email.
            Page titles live on each page, NOT in this bar. */}
        <header className="flex-shrink-0 bg-white border-b border-slate-200 h-14 flex items-center px-4 sm:px-6 lg:px-8 gap-3">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="lg:hidden p-1.5 -ml-1 text-slate-700 hover:text-slate-900 rounded-md hover:bg-slate-100"
            aria-label="Open menu"
          >
            <HamburgerIcon className="w-5 h-5" />
          </button>
          {/* spacer pushes account switcher + email to the right */}
          <div className="flex-1" />
          <div className="hidden sm:block">
            <AccountSwitcher
              activeAccountId={user.accountId}
              activeAccountName={user.accountName}
              memberships={user.memberships}
            />
          </div>
          <span className="hidden md:inline text-xs text-slate-500 truncate max-w-[14rem]">
            {user.email}
          </span>
        </header>

        {/* Sole scroll container — content overflows here, sidebar + top bar stay put. */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const Icon = item.icon;
  const active = item.match.test(pathname);
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={`group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        active
          ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-100'
          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
      }`}
    >
      <Icon className={`w-5 h-5 flex-shrink-0 ${active ? 'text-brand-600' : 'text-slate-400 group-hover:text-slate-500'}`} />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}
