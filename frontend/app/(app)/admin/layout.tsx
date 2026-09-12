import type { ReactNode } from 'react';
import { RoleGate } from '@/components/auth/role-gate';

/**
 * `/admin/*` — platform administration, administrators only.
 *
 * Nothing in this tree is a wider version of a staff screen. Staff operate the services they are
 * assigned to; administration changes what those services *are* — accounts, roles, geometry, policies
 * and analytics across the whole campus — and the two are separate surfaces with separate routes.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <RoleGate roles={['admin']}>{children}</RoleGate>;
}
