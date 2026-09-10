"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "./brand";
import { cn, initialsOf } from "@/lib/utils";
import { authApi } from "@/lib/api";
import { clearSession } from "@/lib/auth/session";
import { useSession } from "@/hooks/use-session";
import {
  IconBell,
  IconCalendar,
  IconCompass,
  IconGrid,
  IconLogout,
  IconMenu,
  IconQueue,
  IconSearch,
  IconSparkle,
  IconUser,
  IconX,
} from "@/components/ui/icons";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  ready: boolean;
}

const NAV: NavItem[] = [
  { href: "/student/dashboard", label: "Dashboard", icon: <IconGrid className="h-[18px] w-[18px]" />, ready: true },
  { href: "/student/timetable", label: "Schedule", icon: <IconCalendar className="h-[18px] w-[18px]" />, ready: true },
  { href: "/student/navigate", label: "Navigate", icon: <IconCompass className="h-[18px] w-[18px]" />, ready: false },
  { href: "/student/rooms", label: "Rooms", icon: <IconSearch className="h-[18px] w-[18px]" />, ready: false },
  { href: "/student/queue", label: "Queue", icon: <IconQueue className="h-[18px] w-[18px]" />, ready: false },
  { href: "/student/notifications", label: "Notifications", icon: <IconBell className="h-[18px] w-[18px]" />, ready: false },
  { href: "/student/assistant", label: "Assistant", icon: <IconSparkle className="h-[18px] w-[18px]" />, ready: false },
  { href: "/student/profile", label: "Profile", icon: <IconUser className="h-[18px] w-[18px]" />, ready: false },
];

export function StudentShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, ready } = useSession();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (ready && !user) {
      router.replace("/login");
    }
  }, [ready, user, router]);

  const signOut = async () => {
    try {
      await authApi.logout();
    } catch {
      // Best-effort: still clear local session if the server is unreachable.
    }
    clearSession();
    router.replace("/login");
  };

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {NAV.map((item) => {
        const active = pathname === item.href;
        if (!item.ready) {
          return (
            <span
              key={item.href}
              aria-disabled
              className="flex cursor-not-allowed items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-ink-400"
            >
              <span className="inline-flex items-center gap-3">
                {item.icon}
                {item.label}
              </span>
              <span className="rounded-full bg-ink-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-500">
                Soon
              </span>
            </span>
          );
        }
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setDrawerOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-brand-50 text-brand-700"
                : "text-ink-600 hover:bg-ink-100 hover:text-ink-900",
            )}
          >
            {item.icon}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const userFooter = user ? (
    <div className="border-t border-ink-200 p-3">
      <div className="flex items-center gap-3 rounded-lg px-2 py-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-accent-600 text-xs font-bold text-white">
          {initialsOf(user.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink-900">{user.name}</p>
          <p className="truncate text-xs text-ink-500 capitalize">{user.role}</p>
        </div>
        <button
          onClick={signOut}
          aria-label="Sign out"
          className="rounded-lg p-2 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
        >
          <IconLogout className="h-[18px] w-[18px]" />
        </button>
      </div>
    </div>
  ) : null;

  return (
    <div className="min-h-screen bg-ink-50">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-ink-200 bg-white md:flex">
        <div className="flex h-16 items-center px-5">
          <Logo />
        </div>
        {nav}
        {userFooter}
      </aside>

      {/* Mobile drawer */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-ink-950/40 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white shadow-lifted animate-fade-in">
            <div className="flex h-16 items-center justify-between px-5">
              <Logo />
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
                className="rounded-lg p-2 text-ink-500 hover:bg-ink-100"
              >
                <IconX className="h-5 w-5" />
              </button>
            </div>
            {nav}
            {userFooter}
          </div>
        </div>
      ) : null}

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-ink-200 bg-white px-4 md:hidden">
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          className="rounded-lg p-2 text-ink-600 hover:bg-ink-100"
        >
          <IconMenu className="h-5 w-5" />
        </button>
        <Logo />
      </header>

      <main className="md:pl-64">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
