import { redirect } from 'next/navigation';

/**
 * `/student` is not a screen — it is the entrance to the student workspace, and the
 * workspace's own home is its dashboard. Kept as a redirect so a hand-typed or bookmarked path
 * still lands somewhere real instead of a 404.
 */
export default function StudentHome() {
  redirect('/student/dashboard');
}
