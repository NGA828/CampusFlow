'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useAsync, relativeTime } from '@/lib/hooks';
import { meApi } from '@/lib/api/endpoints';
import { useAuth } from '@/lib/auth/auth-context';
import { useRealtimeEvent } from '@/lib/realtime/realtime-context';
import { Badge, Button, Card, CardSkeleton, EmptyState, ErrorState, Tabs } from '@/components/ui/kit';
import { PageHeader } from '@/components/layout/app-shell';
import { useToast } from '@/components/ui/toast';
import type { NotificationRow } from '@/lib/api/types';

const LINK_FOR_TYPE: Record<string, string> = {
  'queue.ticket_issued': '/student/services/queues',
  'queue.called': '/student/services/queues',
  'queue.position_updated': '/student/services/queues',
  'queue.no_show': '/student/services/queues',
  'office.ticket_issued': '/student/services/offices',
  'office.called': '/student/services/offices',
  'office.approaching': '/student/services/offices',
  'navigation.:id': '/navigate',
  'event.reminder': '/student/campus/events',
  'class.reminder': '/student/timetable',
};

export default function NotificationsPage() {
  const toast = useToast();
  const { user } = useAuth();
  const [tab, setTab] = useState<'all' | 'unread'>('all');

  const notifications = useAsync(() => meApi.notifications({ per_page: 50 }), []);

  useRealtimeEvent(user ? `user:${user.id}` : null, () => notifications.reload(), []);

  const items = useMemo(() => {
    const list = notifications.data?.items ?? [];
    return tab === 'unread' ? list.filter((item) => !item.read_at) : list;
  }, [notifications.data, tab]);

  const unread = notifications.data?.unread ?? 0;

  const markAll = async () => {
    try {
      await meApi.readAllNotifications();
      toast.success('All notifications marked as read');
      notifications.reload();
    } catch {
      toast.error('Could not mark notifications as read');
    }
  };

  const open = async (notification: NotificationRow) => {
    if (!notification.read_at) {
      try {
        await meApi.readNotification(notification.id);
        notifications.reload();
      } catch {
        /* non-fatal */
      }
    }
  };

  const linkFor = (notification: NotificationRow): string | null => {
    if (notification.type.startsWith('queue.')) return '/student/services/queues';
    if (notification.type.startsWith('office.')) return '/student/services/offices';
    if (notification.type.startsWith('navigation.')) return '/navigate';
    if (notification.type.startsWith('event.')) return '/student/campus/events';
    if (notification.type.startsWith('class.')) return '/student/timetable';
    if (notification.type.startsWith('announcement.')) return '/student/announcements';
    return LINK_FOR_TYPE[notification.type] ?? null;
  };

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Queue calls, class reminders, event updates and announcements — delivered in real time."
        actions={
          unread > 0 ? (
            <Button variant="secondary" size="sm" onClick={() => void markAll()}>
              Mark all as read
            </Button>
          ) : null
        }
      />

      <div className="mb-4">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'all', label: 'All', count: notifications.data?.items.length },
            { value: 'unread', label: 'Unread', count: unread },
          ]}
        />
      </div>

      {notifications.error ? <ErrorState message={notifications.error} onRetry={notifications.reload} /> : null}
      {notifications.loading ? (
        <CardSkeleton rows={5} />
      ) : items.length === 0 ? (
        <EmptyState
          title={tab === 'unread' ? 'You are all caught up' : 'No notifications yet'}
          description="When something needs your attention, it will appear here and can also arrive as a push notification."
        />
      ) : (
        <ul className="space-y-2">
          {items.map((notification) => {
            const href = linkFor(notification);
            const body = (
              <Card
                className={`transition-colors ${notification.read_at ? '' : 'border-brand-200 bg-brand-50/40'}`}
                as="div"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {!notification.read_at ? <span className="h-2 w-2 rounded-full bg-brand-600" /> : null}
                      <p className="text-[13.5px] font-semibold text-ink-900">{notification.title}</p>
                      {notification.priority !== 'normal' ? (
                        <Badge tone={notification.priority === 'urgent' ? 'danger' : 'warning'}>{notification.priority}</Badge>
                      ) : null}
                      <Badge tone="neutral">{notification.type.split('.')[0]}</Badge>
                    </div>
                    <p className="mt-1 text-[13px] leading-relaxed text-ink-600">{notification.body}</p>
                  </div>
                  <span className="whitespace-nowrap text-[12px] text-ink-400">{relativeTime(notification.created_at)}</span>
                </div>
              </Card>
            );

            return (
              <li key={notification.id}>
                {href ? (
                  <Link href={href} onClick={() => void open(notification)}>
                    {body}
                  </Link>
                ) : (
                  <button type="button" className="block w-full text-left" onClick={() => void open(notification)}>
                    {body}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-4 text-[12px] text-ink-400">
        Push delivery is used on the mobile app when you allow notifications; the web app always receives them live over the realtime socket.
      </p>
    </div>
  );
}
