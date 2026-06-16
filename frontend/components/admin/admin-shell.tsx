'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { NotificationBell } from '../notifications/notification-bell';
import { ActionGuard } from '../shared/ActionGuard';
import { Icon } from '../ui/icons';
import { getSession, hasActiveSession, isSuperAdmin, type AuthSession } from '../../lib/auth';
import { hydrateSession, logout as revokeAndClearSession } from '../../lib/api';
import { NAV_GROUPS, getDashboardRouteAccess, isTenantOnlyPath, visibleNavFor, type NavGroup } from './nav-config';
import { CommandPalette } from './command-palette';
import { UserMenu } from './user-menu';

const COLLAPSE_KEY = 'reos_nav_collapsed';

function isActivePath(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  // Avoid /settings matching every /settings/* child as the parent.
  if (href === '/settings') return false;
  return pathname.startsWith(`${href}/`);
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const boot = async () => {
      const current = getSession();
      if (hasActiveSession(current)) {
        setSession(current);
        return;
      }
      const hydrated = await hydrateSession();
      if (hydrated) {
        setSession(hydrated);
        return;
      }
      router.replace('/login');
    };
    void boot();
  }, [router]);

  useEffect(() => {
    if (!session || !isSuperAdmin(session) || !isTenantOnlyPath(pathname)) return;
    router.replace('/platform/organizations');
  }, [pathname, router, session]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(COLLAPSE_KEY);
      if (raw) setCollapsed(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  // Close the mobile drawer on navigation.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Global Cmd/Ctrl+K to toggle the command palette.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toggleGroup = useCallback((group: string) => {
    setCollapsed((prev) => {
      const next = { ...prev, [group]: !prev[group] };
      try {
        localStorage.setItem(COLLAPSE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const logout = useCallback(() => {
    void revokeAndClearSession().finally(() => {
      router.replace('/login');
    });
  }, [router]);

  const visibleNav = useMemo(() => (session ? visibleNavFor(session) : []), [session]);

  if (!session) {
    return (
      <div className="premium-gradient flex min-h-screen items-center justify-center px-4 text-slate-600">
        <div className="panel w-full max-w-sm p-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-700 text-lg font-bold text-white shadow-raised">
            R
          </div>
          <p className="text-sm font-semibold text-slate-900">Preparing RE-OS workspace</p>
          <p className="mt-1 text-xs text-slate-500">Loading your tenant, permissions, and alerts.</p>
        </div>
      </div>
    );
  }

  const superAdmin = isSuperAdmin(session);
  const routeAccess = getDashboardRouteAccess(session, pathname);

  if (superAdmin && isTenantOnlyPath(pathname)) {
    return (
      <div className="premium-gradient flex min-h-screen items-center justify-center px-4 text-slate-600">
        <div className="panel w-full max-w-sm p-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-700 text-lg font-bold text-white shadow-raised">
            RE
          </div>
          <p className="text-sm font-semibold text-slate-900">Switching to platform workspace</p>
          <p className="mt-1 text-xs text-slate-500">Super Admin accounts do not have tenant context.</p>
        </div>
      </div>
    );
  }

  const sidebar = (
    <Sidebar
      session={session}
      superAdmin={superAdmin}
      pathname={pathname}
      visibleNav={visibleNav}
      collapsed={collapsed}
      onToggleGroup={toggleGroup}
      onLogout={logout}
    />
  );

  return (
    <div className="flex h-screen overflow-hidden bg-reos-bg">
      {/* Desktop sidebar — fixed full-height, scrolls independently of content */}
      <aside className="hidden h-screen w-64 shrink-0 lg:block">{sidebar}</aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 animate-fade-in bg-slate-950/50" onClick={() => setMobileOpen(false)} aria-hidden />
          <div className="absolute inset-y-0 left-0 w-72 animate-slide-in-left">{sidebar}</div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="z-30 flex shrink-0 items-center gap-3 border-b border-reos-border bg-white/85 px-4 py-3 backdrop-blur lg:px-8">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="btn-ghost -ml-1 p-2 lg:hidden"
            aria-label="Open navigation menu"
          >
            <Icon name="menu" className="h-5 w-5" />
          </button>

          {/* Global search → opens the command palette */}
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="group flex h-10 max-w-md flex-1 items-center gap-2 rounded-xl border border-reos-border bg-reos-muted px-3 text-left text-sm text-slate-400 transition hover:border-teal-200 hover:bg-white focus:outline-none focus:ring-4 focus:ring-teal-100"
            aria-label="Search (Command or Control K)"
          >
            <Icon name="search" className="h-4 w-4 text-slate-400 group-hover:text-teal-600" />
            <span className="flex-1 truncate">Search pages, properties, leads…</span>
            <span className="hidden items-center gap-1 sm:flex">
              <kbd className="kbd">⌘</kbd>
              <kbd className="kbd">K</kbd>
            </span>
          </button>

          <div className="flex flex-1 items-center justify-end gap-2 sm:gap-3">
            <ActionGuard permission="properties.create">
              <Link href="/properties/new" className="hidden btn-primary px-3 py-2 md:inline-flex">
                <Icon name="plus" className="h-4 w-4" /> Add property
              </Link>
            </ActionGuard>
            <ActionGuard permission="notifications.read" featureFlag="notifications">
              <NotificationBell />
            </ActionGuard>
            <UserMenu session={session} onLogout={logout} />
          </div>
        </header>

        <main className="scrollbar-thin flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[88rem] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {routeAccess.allowed ? children : <AccessDenied reason={routeAccess.reason} />}
          </div>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} session={session} />
    </div>
  );
}

function AccessDenied({ reason }: { reason?: string }) {
  return (
    <div className="mx-auto flex min-h-[55vh] max-w-xl items-center justify-center">
      <div className="panel w-full p-6 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-sm font-bold text-rose-700">
          403
        </div>
        <h1 className="text-xl font-bold tracking-tight text-slate-950">You do not have access to this page</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {reason ?? 'Ask an owner or administrator to grant the required permission.'}
        </p>
      </div>
    </div>
  );
}

// ===========================================================================
// Sidebar
// ===========================================================================

function Sidebar({
  session,
  superAdmin,
  pathname,
  visibleNav,
  collapsed,
  onToggleGroup,
  onLogout,
}: {
  session: AuthSession;
  superAdmin: boolean;
  pathname: string;
  visibleNav: ReturnType<typeof visibleNavFor>;
  collapsed: Record<string, boolean>;
  onToggleGroup: (group: string) => void;
  onLogout: () => void;
}) {
  const workspaceLabel = superAdmin ? 'Platform' : 'Workspace';
  const workspaceSub = superAdmin ? 'Cross-tenant control' : 'Tenant operations';

  return (
    <div className="flex h-full flex-col bg-reos-sidebar text-white">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 pb-4 pt-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500 text-sm font-bold text-white shadow-raised">
          RE
        </div>
        <div className="min-w-0">
          <p className="text-base font-bold tracking-tight">RE-OS</p>
          <p className="truncate text-2xs text-slate-400">Real estate operating system</p>
        </div>
      </div>

      {/* Workspace switcher */}
      <div className="px-3">
        <Link
          href={superAdmin ? '/platform/organizations' : '/settings'}
          className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 transition hover:border-teal-400/40 hover:bg-white/10"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/20 text-teal-300">
            <Icon name={superAdmin ? 'organizations' : 'building'} className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-white">{workspaceLabel}</span>
            <span className="block truncate text-2xs text-slate-400">{workspaceSub}</span>
          </span>
          <Icon name="chevronRight" className="h-4 w-4 text-slate-500" />
        </Link>
      </div>

      {/* Navigation */}
      <nav className="scrollbar-thin mt-3 flex-1 space-y-3 overflow-y-auto px-3 pb-4" aria-label="Primary">
        {NAV_GROUPS.map((group: NavGroup) => {
          const items = visibleNav.filter((item) => item.group === group);
          if (!items.length) return null;
          const isCollapsed = collapsed[group];
          return (
            <div key={group}>
              <button
                type="button"
                onClick={() => onToggleGroup(group)}
                className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-2xs font-bold uppercase tracking-[0.16em] text-slate-500 transition hover:text-slate-300"
                aria-expanded={!isCollapsed}
              >
                <span>{group}</span>
                <Icon name="chevronDown" className={`h-3.5 w-3.5 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
              </button>
              {!isCollapsed ? (
                <div className="mt-1 space-y-0.5">
                  {items.map((item) => {
                    const active = isActivePath(pathname, item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        className={`sidebar-link ${active ? 'sidebar-link-active' : ''}`}
                      >
                        <Icon name={item.icon} className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-teal-300' : 'text-slate-400'}`} />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-100 text-xs font-bold uppercase text-teal-900">
            {(session.user.first_name?.slice(0, 2) ?? session.user.email.slice(0, 2)).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-white">{session.user.email}</p>
            <p className="truncate text-2xs capitalize text-slate-400">
              {superAdmin ? 'Platform Admin' : session.user.roles[0]?.replace(/_/g, ' ') ?? 'User'}
            </p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            aria-label="Log out"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-teal-400/50"
          >
            <Icon name="logout" className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
