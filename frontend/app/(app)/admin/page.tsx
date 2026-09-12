import { redirect } from 'next/navigation';

/** `/admin` → the administration dashboard. See the note on `/student`. */
export default function AdminHome() {
  redirect('/admin/dashboard');
}
