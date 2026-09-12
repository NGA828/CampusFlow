import type { ReactNode } from 'react';
import { RoleGate } from '@/components/auth/role-gate';

/**
 * `/student/*` — the student web workspace.
 *
 * Students only. A staff or administrator principal is redirected to their own console, because a
 * student screen renders student data for the caller and would answer with an empty list rather than a
 * permission error — the worst possible failure mode, since it looks like "there is nothing here".
 */
export default function StudentLayout({ children }: { children: ReactNode }) {
  return <RoleGate roles={['student']}>{children}</RoleGate>;
}
