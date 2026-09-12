import { Redirect } from 'expo-router';

import { Loading } from '@/components/ui';
import { ROLE_ROOT, useAuth } from '@/lib/auth';

/**
 * The root route is a switchboard, not a home screen.
 *
 * There is no shared "mobile dashboard" in this product: a student's phone is a wayfinding and
 * queue companion, a staff member's is a service desk, and an administrator's is a pager. Where you
 * land is decided by the role on the token, and the role's own tree is the only thing that can render.
 */
export default function Index() {
  const { user, ready } = useAuth();

  if (!ready) return <Loading label="Restoring your session…" />;
  if (!user) return <Redirect href="/login" />;

  return <Redirect href={ROLE_ROOT[user.role_code as keyof typeof ROLE_ROOT] ?? '/login'} />;
}
