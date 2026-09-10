'use client';

import { AppShell } from '../../components/layout/app-shell';
import { useRequireAuth } from '../../lib/auth/auth-context';
import { Spinner } from '../../components/ui/kit';

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
