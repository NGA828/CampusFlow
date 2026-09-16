'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAsync } from '@/lib/hooks';
import { meApi } from '@/lib/api/endpoints';
import { useAuth } from '@/lib/auth/auth-context';
import { useRealtime, useRealtimeEvent } from '@/lib/realtime/realtime-context';
import { notificationHref } from '@/lib/companion-links';
import { Button, CardSkeleton, Input } from '@/components/ui/kit';
import { WorkspaceIcon, type WorkspaceIconName } from '@/components/layout/workspace-visual';
import { CompanionHeading, Empty, Feedback, ReadError, errorMessage, momentLabel } from '@/components/layout/student-companion';
import s from '@/components/layout/student-companion.module.css';

const ICONS: Record<string, WorkspaceIconName> = { queue: 'queue', office: 'office', class: 'calendar', event: 'calendar', announcement: 'bulletin', navigation: 'compass' };
export default function NotificationsPage() {
  const { user } = useAuth();
  const { connected } = useRealtime();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const [confirmedUnread, setConfirmedUnread] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ error?: boolean; message: string } | null>(null);
  const lock = useRef(false);
  const notifications = useAsync(() => meApi.notifications({ page, per_page: 20 }), [page]);
  const reloadNotifications = notifications.reload;
  function refresh() {
    if (lock.current) return;
    setConfirmed(new Set()); setConfirmedUnread(null); notifications.reload();
  }
  useEffect(() => {
    const changed = () => {
      if (lock.current) return;
      setConfirmed(new Set()); setConfirmedUnread(null); reloadNotifications();
    };
    window.addEventListener('campusflow:notifications-changed', changed);
    return () => window.removeEventListener('campusflow:notifications-changed', changed);
  }, [reloadNotifications]);
  useRealtimeEvent(user ? `user:${user.id}` : null, refresh);
  const unread = confirmedUnread ?? notifications.data?.unread;
  const items = (notifications.data?.items ?? []).filter(item => (filter === 'all' || (!item.read_at && !confirmed.has(item.id))) && `${item.title} ${item.body}`.toLowerCase().includes(search.trim().toLowerCase()));
  const meta = notifications.loading || notifications.error ? undefined : notifications.data?.meta;
  async function mark(id?: string) {
    if (lock.current) return;
    lock.current = true; setBusy(id ?? 'all'); setFeedback(null);
    try {
      const result = id ? await meApi.readNotification(id) : await meApi.readAllNotifications();
      if (!Number.isFinite(result.unread) || result.unread < 0) throw new Error('The server did not confirm the read status. Refresh and try again.');
      setConfirmed(current => new Set([...current, ...(id ? [id] : (notifications.data?.items ?? []).map(item => item.id))]));
      setConfirmedUnread(result.unread);
      setFeedback({ message: id ? 'Notification marked as read.' : 'All notifications in your account are marked as read.' });
    } catch (error) { setFeedback({ error: true, message: errorMessage(error, 'The read status could not be saved. Please try again.') }); }
    finally { lock.current = false; setBusy(null); }
  }
  function changePage(next: number) {
    if (lock.current) return;
    setPage(next); setConfirmed(new Set()); setConfirmedUnread(null); setFeedback(null);
  }
  return <div className={s.page}>
    <CompanionHeading eyebrow="Your workspace · activity inbox" title="Notifications" description="Campus updates, in one place. Read what matters, then carry on with your day." actions={<><Button variant="secondary" disabled={!!busy || notifications.loading} onClick={refresh}>Refresh inbox</Button><Button disabled={!!busy || notifications.loading || !!notifications.error || !unread} loading={busy === 'all'} onClick={() => void mark()}>Mark all as read</Button></>} />
    <div className={s.inboxLayout}>
      <section className={s.inbox} aria-label="Notification inbox" aria-busy={notifications.loading}>
        <div className={s.inboxToolbar}>
          <div className={s.sectionHead}><h2>Your updates</h2><span className={s.status}>{notifications.loading || notifications.error || unread === undefined ? 'Unread count unavailable' : `${unread} unread overall`}</span></div>
          <Input aria-label="Search this notification page" placeholder="Search this page of updates…" value={search} onChange={e => setSearch(e.target.value)} />
          <div className={s.filters} aria-label="Filter notifications"><button aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All on this page</button><button aria-pressed={filter === 'unread'} onClick={() => setFilter('unread')}>Unread on this page</button></div>
        </div>
        <div aria-live="polite">{feedback && <Feedback error={feedback.error}>{feedback.message}</Feedback>}</div>
        {notifications.loading ? <CardSkeleton rows={7} /> : notifications.error ? <ReadError message={notifications.error} retry={refresh} /> : items.length ? <ul className={s.noticeList}>{items.map(item => {
          const isUnread = !item.read_at && !confirmed.has(item.id);
          const category = item.type.split('.')[0];
          const href = user ? notificationHref(item.type, user.role_code) : null;
          return <li key={item.id} className={s.notice} data-unread={isUnread}>
            <span className={s.noticeIcon}><WorkspaceIcon name={ICONS[category] ?? 'bulletin'} size={20} /></span>
            <div><div className={s.noticeMeta}><span>{category}</span><span aria-hidden="true">·</span><time dateTime={item.created_at}>{momentLabel(item.created_at)}</time><span className={s.status} data-tone={isUnread ? undefined : 'quiet'}>{isUnread ? 'Unread' : 'Read'}</span>{['urgent', 'critical', 'high'].includes(item.priority) && <span className={s.status} data-tone="attention">{item.priority} priority</span>}</div>
              <h2>{item.title}</h2><p>{item.body}</p>
              <div className={s.actions}>{isUnread && <Button variant="secondary" size="sm" disabled={!!busy} loading={busy === item.id} aria-label={`Mark ${item.title} as read`} onClick={() => void mark(item.id)}>Mark as read</Button>}{href && <Link className={s.link} href={href}>Open {category === 'class' ? 'timetable' : category === 'navigation' ? 'campus map' : category === 'queue' ? 'queue board' : category === 'office' ? 'office services' : `${category}s`} <WorkspaceIcon name="arrow" size={15} /></Link>}</div>
            </div>
          </li>;
        })}</ul> : <Empty title={search ? 'No matching updates' : filter === 'unread' ? 'No unread updates on this page' : 'No notifications yet'}>{search ? 'Try a different title or word. Search applies only to the current page.' : filter === 'unread' ? 'Other pages may still contain unread updates. Use All on this page to see the full list.' : 'Updates will appear here when the campus system sends them to your account.'}</Empty>}
        <footer className={s.inboxFoot}><p>{meta ? `Page ${meta.page} of ${Math.max(1, meta.total_pages)} · ${meta.total} total` : 'Your personal campus updates'}</p>{meta && meta.total_pages > 1 && <div className={s.actions}><Button variant="secondary" size="sm" disabled={!!busy || notifications.loading || page <= 1} onClick={() => changePage(page - 1)}>Previous page</Button><Button variant="secondary" size="sm" disabled={!!busy || notifications.loading || page >= meta.total_pages} onClick={() => changePage(page + 1)}>Next page</Button></div>}</footer>
      </section>
      <aside className={s.inboxNote}><WorkspaceIcon name="bulletin" size={26} /><h2>A quieter inbox.</h2><p>Marking an update as read keeps it here for later. Opening a linked workspace doesn’t change its read status.</p><div className={s.unreadTotal}><strong>{notifications.loading || notifications.error ? '—' : unread ?? '—'}</strong><span>unread across your account</span></div><p>Search and the unread filter apply to the current page. “Mark all” applies to every notification in your account.</p></aside>
    </div>
    <p className={s.connection}>{connected ? 'Connected to campus updates. Refresh to confirm the latest inbox state.' : 'Live connection unavailable. Use Refresh inbox to check for new updates.'} Browser push delivery is not configured.</p>
  </div>;
}
