'use client';

import { AppShell } from '@/components/layout/app-shell';
import { useRequireAuth } from '@/lib/auth/auth-context';
import { Spinner } from '@/components/ui/kit';

/**
 * The only shared frame in the authenticated app, and it is shared in the narrow sense: it knows that a
 * principal must exist and it renders the chrome. Which *workspace* the person is inside is decided one
 * level down by the role layouts (`/student`, `/staff`, `/admin`), each of which gates its own tree.
 *
 * There is no role logic here — no "if admin, show the staff menu", which is how a single menu used to
 * grow into everybody's menu.
 */
export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { loading, user } = useRequireAuth();

  if (loading || !user) {
    return (
      <div className="grid min-h-dvh place-items-center bg-ink-50">
        <div className="flex flex-col items-center gap-3 text-ink-500">
          <Spinner className="h-6 w-6 text-brand-600" />
          <p className="text-[13px]">Loading your campus…</p>
        </div>
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
