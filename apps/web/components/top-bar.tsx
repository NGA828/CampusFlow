'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { HOME_FOR, useSession } from '@/lib/session';

/** Navigation is role-shaped: people only see the area they actually hold. */
export function TopBar() {
  const { user, loading, signOut } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  const links =
    user?.role === 'STUDENT'
      ? [
          { href: '/student', label: 'My campus' },
          { href: '/student/map', label: 'Map & routes' },
          { href: '/student/rooms', label: 'Rooms & bookings' },
          { href: '/student/campus-life', label: 'Events & notices' },
        ]
      : user?.role === 'STAFF'
        ? [
            { href: '/staff', label: 'Requests' },
            { href: '/staff/publish', label: 'Publish' },
            { href: '/', label: 'Directory' },
          ]
        : user?.role === 'ADMIN'
          ? [
              // An administrator may also work the scolarité desk — the API allows it,
              // so the navigation should not pretend those pages are out of reach.
              { href: '/admin', label: 'Administration' },
              { href: '/staff', label: 'Requests' },
              { href: '/staff/publish', label: 'Publish' },
              { href: '/', label: 'Public directory' },
            ]
          : [
              { href: '/', label: 'Directory' },
              { href: '/register', label: 'Create account' },
            ];

  return (
    <header className="topbar">
      <div className="shell topbarInner">
        <Link href={user ? HOME_FOR[user.role] : '/'} className="brand">
          <span className="brandMark">CF</span>
          CampusFlow
        </Link>
        <nav className="navLinks">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className={pathname === link.href ? 'active' : undefined}>
              {link.label}
            </Link>
          ))}
          {loading ? null : user ? (
            <button
              type="button"
              onClick={async () => {
                await signOut();
                router.replace('/login');
              }}
            >
              Sign out · {user.name.split(' ')[0]}
            </button>
          ) : (
            <Link href="/login" className={pathname === '/login' ? 'active' : undefined}>
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
