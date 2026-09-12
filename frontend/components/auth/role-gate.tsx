'use client';

import type { ReactNode } from 'react';
import { useRequireAuth } from '@/lib/auth/auth-context';
import type { Role } from '@/lib/api/types';
import { Spinner } from '@/components/ui/kit';

/**
 * The client half of a role-scoped route tree.
 *
 * This is not the security boundary — the API is. What it buys is that the wrong product never
 * renders: a staff member who follows a student link gets a spinner on the way to their own console
 * instead of a flash of somebody else's dashboard, and an unauthenticated visitor never mounts a
 * screen that would fire forty authenticated requests and fail every one of them.
 *
 * Each role tree (`/student/*`, `/staff/*`, `/admin/*`) declares its own gate, so adding a page inside
 * the tree cannot accidentally publish it to another role.
 */
export function RoleGate({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, loading } = useRequireAuth(roles);

  if (loading || !user || !roles.includes(user.role_code)) {
    return (
      <div className="grid min-h-dvh place-items-center bg-ink-50">
        <div className="flex flex-col items-center gap-3 text-ink-500">
          <Spinner className="h-6 w-6 text-brand-600" />
          <p className="text-[13px]">Taking you to your own workspace…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
