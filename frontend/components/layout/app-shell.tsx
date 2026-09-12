'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { useRealtime, useRealtimeEvent } from '@/lib/realtime/realtime-context';
import { Button, Avatar, Badge, cx } from '@/components/ui/kit';
import { meApi } from '@/lib/api/endpoints';
import type { NotificationRow } from '@/lib/api/types';
import { relativeTime } from '@/lib/hooks';

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  match?: string[];
  badge?: 'notifications' | 'ticket';
  /** Shared surfaces (notifications, account) exist outside the role tree and are not a leak. */
  shared?: boolean;
}

const icon = (path: ReactNode) => (
  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {path}
  </svg>
);

type NavSection = { title: string; items: NavItem[] };

/**
 * Three navigation trees, chosen by role — not one menu with items switched on and off.
 *
 * The difference matters twice over. A student never sees an "Operations" group they would only be
 * refused, and a staff member never sees "Room queues" that would tempt them into a queue they are
 * supposed to be *running*. Each entry below also exists at that URL for that role only: the route
 * trees in `app/(app)/student`, `staff` and `admin` are gated by `RoleGate`, and the API rejects the
 * same combinations independently of this file.
 *
 * Nothing here is a camera, a scanner, or a live navigation control. Those capabilities are mobile-only
 * (`qr.scan`, `navigation.live`), so this app has no page that could honour them, and no dead button
 * pretending that it does.
 */
const STUDENT_SECTIONS: NavSection[] = [
  {
    title: 'Today',
    items: [
      { href: '/student/dashboard', label: 'Dashboard', icon: icon(<><path d="M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-4H4zM14 8h6V4h-6z" /></>) },
      { href: '/student/timetable', label: 'Timetable', icon: icon(<><path d="M8 4v3M16 4v3M4 10h16M5 6h14a1 1 0 011 1v12a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1z" /></>) },
      { href: '/notifications', label: 'Notifications', icon: icon(<><path d="M6 9a6 6 0 1112 0c0 4 1.5 5.5 1.5 5.5h-15S6 13 6 9zM10 20a2 2 0 004 0" /></>), badge: 'notifications' },
    ],
  },
  {
    title: 'Campus',
    items: [
      { href: '/student/campus/map', label: 'Map & route preview', icon: icon(<><path d="M9 4l6 2 6-2v14l-6 2-6-2-6 2V6z" /><path d="M9 4v14M15 6v14" /></>) },
      { href: '/student/campus/rooms', label: 'Rooms & availability', icon: icon(<><path d="M4 20V6a2 2 0 012-2h8a2 2 0 012 2v14M4 20h16M16 20v-8h2a2 2 0 012 2v6M8 8h4v4H8z" /></>) },
      { href: '/student/campus/events', label: 'Events', icon: icon(<><path d="M12 3l2.6 5.6 6 .7-4.4 4.1 1.2 6-5.4-3-5.4 3 1.2-6L3.4 9.3l6-.7z" /></>) },
      { href: '/student/announcements', label: 'Announcements', icon: icon(<><path d="M4 6h16v10H5.5L4 18z" /><path d="M8 10h8" /></>) },
    ],
  },
  {
    title: 'Services',
    items: [
      { href: '/student/services/queues', label: 'Room queue tickets', icon: icon(<><path d="M4 6h16M4 12h10M4 18h7" /><circle cx="17" cy="12" r="3" /></>) },
      { href: '/student/services/offices', label: 'Office tickets', icon: icon(<><path d="M4 20h16M6 20V9l6-4 6 4v11M10 20v-5h4v5" /></>) },
      { href: '/student/assistant', label: 'AI assistant', icon: icon(<><circle cx="12" cy="12" r="9" /><path d="M8.5 13.5c1 1.2 2.2 1.8 3.5 1.8s2.5-.6 3.5-1.8M9.5 9.5v.5M14.5 9.5v.5" /></>) },
    ],
  },
];

const STAFF_SECTIONS: NavSection[] = [
  {
    title: 'Operations',
    items: [
      { href: '/staff/dashboard', label: 'Service desk', icon: icon(<><path d="M4 20V8l8-4 8 4v12M9 20v-6h6v6" /></>) },
      { href: '/staff/queues', label: 'My room queues', icon: icon(<><path d="M4 6h16M4 12h10M4 18h7" /><circle cx="17" cy="12" r="3" /></>) },
      { href: '/staff/offices', label: 'My offices', icon: icon(<><path d="M4 20h16M6 20V9l6-4 6 4v11M10 20v-5h4v5" /></>) },
    ],
  },
  {
    title: 'Teaching & content',
    items: [
      { href: '/staff/timetable', label: 'My timetable', icon: icon(<><path d="M8 4v3M16 4v3M4 10h16M5 6h14a1 1 0 011 1v12a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1z" /></>) },
      { href: '/staff/content', label: 'Events & notices', icon: icon(<><path d="M12 3l2.6 5.6 6 .7-4.4 4.1 1.2 6-5.4-3-5.4 3 1.2-6L3.4 9.3l6-.7z" /></>) },
    ],
  },
  {
    title: 'Campus',
    items: [
      { href: '/staff/rooms', label: 'Rooms I can run', icon: icon(<><path d="M4 20V6a2 2 0 012-2h8a2 2 0 012 2v14M4 20h16M16 20v-8h2a2 2 0 012 2v6M8 8h4v4H8z" /></>) },
      { href: '/notifications', label: 'Notifications', icon: icon(<><path d="M6 9a6 6 0 1112 0c0 4 1.5 5.5 1.5 5.5h-15S6 13 6 9zM10 20a2 2 0 004 0" /></>), badge: 'notifications', shared: true },
    ],
  },
];

const ADMIN_SECTIONS: NavSection[] = [
  {
    title: 'Platform',
    items: [
      { href: '/admin/dashboard', label: 'Overview', icon: icon(<><path d="M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-4H4zM14 8h6V4h-6z" /></>) },
      { href: '/admin/alerts', label: 'Alerts', icon: icon(<><path d="M12 9v4M12 16.5v.5M10.3 3.9L2.5 18a2 2 0 001.7 3h15.6a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" /></>) },
      { href: '/admin/analytics', label: 'Analytics', icon: icon(<><path d="M4 20V6M10 20v-8M16 20v-5M20 20H4" /></>) },
    ],
  },
  {
    title: 'Access',
    items: [
      { href: '/admin/users', label: 'Users & roles', icon: icon(<><circle cx="9" cy="9" r="3" /><path d="M3 20a6 6 0 0112 0M16 11a3 3 0 100-6M18 20a5 5 0 00-3-4.6" /></>) },
      { href: '/admin/settings', label: 'Settings & audit', icon: icon(<><circle cx="12" cy="12" r="3" /><path d="M12 3v2M12 19v2M5 12H3M21 12h-2M6.3 6.3l-1.4-1.4M19.1 19.1l-1.4-1.4M17.7 6.3l1.4-1.4M4.9 19.1l1.4-1.4" /></>) },
    ],
  },
  {
    title: 'Campus model',
    items: [
      { href: '/admin/campus', label: 'Buildings & rooms', icon: icon(<><path d="M4 20V7a2 2 0 012-2h6l2 2h4a2 2 0 012 2v11M4 20h16M9 12h2M9 16h2M14 12h2M14 16h2" /></>) },
      { href: '/admin/spatial', label: 'Maps, QR & geofences', icon: icon(<><path d="M12 21s7-5.4 7-11a7 7 0 10-14 0c0 5.6 7 11 7 11z" /><circle cx="12" cy="10" r="2" /></>) },
      { href: '/admin/services', label: 'Queues & offices', icon: icon(<><path d="M4 6h16M4 12h10M4 18h7" /><circle cx="17" cy="12" r="3" /></>) },
      { href: '/admin/academics', label: 'Academics', icon: icon(<><path d="M4 6h16M4 12h16M4 18h10" /></>) },
    ],
  },
];

const SECTIONS_BY_ROLE: Record<string, NavSection[]> = {
  student: STUDENT_SECTIONS,
  staff: STAFF_SECTIONS,
  admin: ADMIN_SECTIONS,
};

const WORKSPACE_LABEL: Record<string, { name: string; purpose: string; home: string }> = {
  student: { name: 'Student workspace', purpose: 'Plan your week, check room and office availability, preview a route.', home: '/student/dashboard' },
  staff: { name: 'Operations console', purpose: 'Run the lines and desks you are assigned to. Policy is set in the admin console.', home: '/staff/dashboard' },
  admin: { name: 'Administration', purpose: 'Configure the campus, its services, and who may do what.', home: '/admin/dashboard' },
};

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { connected } = useRealtime();
  const [unread, setUnread] = useState(0);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [bellOpen, setBellOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const role = user?.role_code ?? 'student';
  const sections = SECTIONS_BY_ROLE[role] ?? STUDENT_SECTIONS;
  const workspace = WORKSPACE_LABEL[role] ?? WORKSPACE_LABEL.student;
  const navigation = useMemo(() => sections.flatMap((section) => section.items), [sections]);

  // A narrow responsive bar, drawn from the same role tree rather than a separate "mobile" list —
  // the phone-sized web is still the web workspace, and the native app is where the camera lives.
  const mobileNav = useMemo(() => navigation.slice(0, 4), [navigation]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    meApi
      .notifications({ per_page: 8 })
      .then((payload) => {
        if (!active) return;
        setNotifications(payload.items);
        setUnread(payload.unread);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user, pathname]);

  useRealtimeEvent(user ? `user:${user.id}` : null, (event) => {
    if (event.event === 'notification.created') {
      const notification = (event.payload as { notification?: NotificationRow }).notification;
      if (notification) {
        setNotifications((current) => [notification, ...current].slice(0, 8));
        setUnread((count) => count + 1);
      }
    }
  });

  const markAllRead = async () => {
    await meApi.readAllNotifications().catch(() => null);
    setUnread(0);
    setNotifications((current) => current.map((item) => ({ ...item, read_at: item.read_at ?? new Date().toISOString() })));
  };

  return (
    <div className="min-h-dvh bg-ink-50 lg:grid lg:grid-cols-[264px_1fr]">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-ink-100 bg-white lg:flex">
        <Link href={workspace.home} className="flex items-center gap-2.5 px-5 py-5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-[14px] font-bold text-white">CF</span>
          <span>
            <span className="block text-[14px] leading-tight font-semibold text-ink-900">CampusFlow</span>
            <span className="block text-[11px] text-ink-500">Navigate. Learn. Connect.</span>
          </span>
        </Link>

        <p className="px-5 pb-3 text-[11px] leading-snug text-ink-400">{workspace.purpose}</p>

        <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 pb-4">
          {sections.map((section) => (
            <div key={section.title} className="mb-3">
              <p className="px-3 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-ink-400">{section.title}</p>
              {section.items.map((item) => {
            const active = pathname === item.href || (item.match ?? []).some((match) => pathname.startsWith(match));
            const count = item.badge === 'notifications' ? unread : 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cx(
                  'mb-0.5 flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-[13.5px] font-medium transition-colors',
                  active ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-ink-100/70 hover:text-ink-900',
                )}
              >
                <span className={active ? 'text-brand-600' : 'text-ink-400'}>{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {count > 0 ? <Badge tone="danger" className="!px-2 !py-0">{count}</Badge> : null}
              </Link>
            );
                })}
              </div>
            ))}

          <div className="mt-2 rounded-[10px] border border-dashed border-ink-200 px-3 py-2.5 text-[11.5px] leading-snug text-ink-500">
            On your phone, CampusFlow adds the camera: scan a location code, join a queue from the door
            and follow turn-by-turn navigation. Those actions stay on mobile by design.
          </div>
        </nav>

        <div className="border-t border-ink-100 px-3 py-3">
          <div className="flex items-center gap-2 px-2 pb-2 text-[12px] text-ink-500">
            <span className={cx('h-2 w-2 rounded-full', connected ? 'bg-mint-500' : 'bg-ink-300')} />
            {connected ? 'Live updates on' : 'Reconnecting…'}
          </div>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="flex w-full items-center gap-2.5 rounded-[10px] px-2 py-2 text-left hover:bg-ink-100/70"
          >
            <Avatar name={user?.name ?? 'Guest'} size={32} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-ink-800">{user?.name}</span>
              <span className="block truncate text-[11.5px] text-ink-500 capitalize">{user?.role_code}</span>
            </span>
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-ink-400" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9l6 6 6-6" strokeLinecap="round" />
            </svg>
          </button>
          {menuOpen ? (
            <div className="mt-1 rounded-[10px] border border-ink-100 bg-white p-1 shadow-[var(--shadow-card)]">
              <Link href="/account" className="block rounded-[8px] px-3 py-2 text-[13px] text-ink-700 hover:bg-ink-50">
                Account & devices
              </Link>
              <Link href="/status" className="block rounded-[8px] px-3 py-2 text-[13px] text-ink-700 hover:bg-ink-50">
                Service status
              </Link>
              <button type="button" onClick={() => void logout()} className="block w-full rounded-[8px] px-3 py-2 text-left text-[13px] text-coral-600 hover:bg-coral-50">
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </aside>

      <div className="flex min-h-dvh flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-ink-100 bg-white/85 backdrop-blur">
          <div className="flex items-center gap-2 px-4 py-3 lg:px-6">
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-[10px] border border-ink-200 lg:hidden"
              aria-label="Open navigation"
              onClick={() => setMobileNavOpen((open) => !open)}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
              </svg>
            </button>
            <Link href={workspace.home} className="flex items-center gap-2 lg:hidden">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-[12px] font-bold text-white">CF</span>
            </Link>

            <div className="ml-auto flex items-center gap-1.5">
              <span className="hidden items-center gap-1.5 rounded-[10px] bg-ink-100/80 px-3 py-2 text-[12px] font-medium text-ink-600 sm:flex">
                {workspace.name}
              </span>

              <div className="relative">
                <button
                  type="button"
                  aria-label="Notifications"
                  onClick={() => setBellOpen((open) => !open)}
                  className="relative grid h-10 w-10 place-items-center rounded-[10px] border border-ink-200 text-ink-600 hover:border-ink-300"
                >
                  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7">
                    <path d="M6 9a6 6 0 1112 0c0 4 1.5 5.5 1.5 5.5h-15S6 13 6 9zM10 20a2 2 0 004 0" strokeLinecap="round" />
                  </svg>
                  {unread > 0 ? (
                    <span className="tnum absolute -top-1.5 -right-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-coral-500 px-1 text-[11px] font-semibold text-white">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  ) : null}
                </button>

                {bellOpen ? (
                  <div className="animate-rise absolute right-0 z-40 mt-2 w-[340px] max-w-[calc(100vw-2rem)] rounded-[var(--radius-card)] border border-ink-100 bg-white shadow-[var(--shadow-pop)]">
                    <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
                      <p className="text-[13.5px] font-semibold text-ink-900">Notifications</p>
                      {unread > 0 ? (
                        <button type="button" onClick={() => void markAllRead()} className="text-[12.5px] font-medium text-brand-600 hover:text-brand-700">
                          Mark all read
                        </button>
                      ) : null}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <p className="px-4 py-6 text-center text-[13px] text-ink-500">You have no notifications yet.</p>
                      ) : (
                        notifications.map((notification) => (
                          <div key={notification.id} className={cx('border-b border-ink-50 px-4 py-3 last:border-0', !notification.read_at && 'bg-brand-50/40')}>
                            <p className="text-[13px] font-medium text-ink-800">{notification.title}</p>
                            <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-500">{notification.body}</p>
                            <p className="mt-1 text-[11.5px] text-ink-400">{relativeTime(notification.created_at)}</p>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="border-t border-ink-100 px-4 py-2.5">
                      <Link href="/notifications" onClick={() => setBellOpen(false)} className="text-[12.5px] font-medium text-brand-600 hover:text-brand-700">
                        View all notifications
                      </Link>
                    </div>
                  </div>
                ) : null}
              </div>

              <Link href="/account" title="Account & devices" className="hidden items-center gap-2 rounded-[10px] border border-ink-200 px-2 py-1.5 hover:border-ink-300 sm:flex">
                <Avatar name={user?.name ?? 'Guest'} size={26} />
                <span className="text-[12.5px] font-medium text-ink-700">{user?.name?.split(' ')[0]}</span>
              </Link>
            </div>
          </div>

          {mobileNavOpen ? (
            <nav className="scrollbar-thin max-h-[70dvh] overflow-y-auto border-t border-ink-100 px-3 pb-3 lg:hidden">
              <div className="grid grid-cols-2 gap-1 pt-2">
                {navigation.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileNavOpen(false)}
                    className={cx(
                      'flex items-center gap-2 rounded-[10px] px-3 py-2 text-[13px] font-medium',
                      pathname === item.href ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-ink-100/70',
                    )}
                  >
                    <span className="text-ink-400">{item.icon}</span>
                    {item.label}
                  </Link>
                ))}
              </div>
              <Button variant="secondary" size="sm" className="mt-3 w-full" onClick={() => void logout()}>
                Sign out
              </Button>
            </nav>
          ) : null}
        </header>

        <main className="flex-1 px-4 pt-5 pb-24 lg:px-6 lg:pb-10">{children}</main>

        {/* Bottom navigation (mobile) */}
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-100 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
          <div className="flex items-stretch justify-around">
            {mobileNav.map((item) => {
              const active = pathname === item.href;
              return (
                <Link key={item.href} href={item.href} className={cx('flex flex-1 flex-col items-center gap-1 py-2.5 text-[10.5px] font-medium', active ? 'text-brand-700' : 'text-ink-500')}>
                  <span className={active ? 'text-brand-600' : 'text-ink-400'}>{item.icon}</span>
                  {item.label.replace('Campus ', '').replace('Room ', '')}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  breadcrumb?: { label: string; href?: string }[];
}) {
  return (
    <div className="mb-5">
      {breadcrumb?.length ? (
        <nav className="mb-2 flex items-center gap-1.5 text-[12px] text-ink-500" aria-label="Breadcrumb">
          {breadcrumb.map((crumb, index) => (
            <span key={`${crumb.label}-${index}`} className="flex items-center gap-1.5">
              {index > 0 ? <span className="text-ink-300">/</span> : null}
              {crumb.href ? (
                <Link href={crumb.href} className="hover:text-ink-700">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-ink-600">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] leading-tight font-semibold text-ink-900 sm:text-[26px]">{title}</h1>
          {description ? <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-ink-500">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
