import type { ReactNode } from 'react';
import { RoleGate } from '@/components/auth/role-gate';

/**
 * `/staff/*` — the operations console, staff only.
 *
 * It holds the queue and office verbs, the operator's own timetable and the content desk may publish.
 * It deliberately contains no student-facing surface: no QR scanner, no wayfinding, no "join a queue"
 * and no student timetable. An operator's own account is not a student account, and a screen that could
 * show either would eventually show the wrong person's data.
 */
export default function StaffLayout({ children }: { children: ReactNode }) {
  return <RoleGate roles={['staff']}>{children}</RoleGate>;
}
