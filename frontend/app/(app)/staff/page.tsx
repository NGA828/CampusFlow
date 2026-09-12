import { redirect } from 'next/navigation';

/** `/staff` → the operations dashboard. See the note on `/student`. */
export default function StaffHome() {
  redirect('/staff/dashboard');
}
