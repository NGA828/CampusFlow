'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useRequireRole } from '@/lib/session';
import type { Announcement, CampusEvent, NotificationItem } from '@/lib/types';

export default function CampusLifePage() {
  const { user, loading } = useRequireRole('STUDENT');
  const [events, setEvents] = useState<CampusEvent[]>([]);
  const [notices, setNotices] = useState<Announcement[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      try {
        const [eventPayload, noticePayload, notificationPayload] = await Promise.all([
          api<{ items: CampusEvent[] }>(`/events?university=${user.universitySlug}`),
          api<{ items: Announcement[] }>(`/announcements?university=${user.universitySlug}`),
          api<{ items: NotificationItem[] }>('/notifications'),
        ]);
        setEvents(eventPayload.items);
        setNotices(noticePayload.items);
        setNotifications(notificationPayload.items);
      } catch {
        setError('Campus life could not be loaded.');
      }
    })();
  }, [user]);

  if (loading || !user) {
    return (
      <main className="shell" style={{ paddingBlock: 40 }}>
        <div className="skeleton" style={{ maxWidth: 280, height: 26 }} />
      </main>
    );
  }

  return (
    <main className="shell" style={{ paddingBlock: 36 }}>
      <p className="eyebrow">Campus life</p>
      <h1 style={{ marginTop: 8 }}>Events, notices and your notifications</h1>
      {error ? <p className="notice noticeError" style={{ marginTop: 14 }}>{error}</p> : null}

      <div className="grid cols3" style={{ marginTop: 22 }}>
        <section className="card">
          <h2 style={{ fontSize: 18 }}>Events</h2>
          <ul className="list" style={{ marginTop: 12 }}>
            {events.map((event) => (
              <li key={event.id} className="row" style={{ display: 'block' }}>
                <strong>{event.title}</strong>
                <p className="muted" style={{ marginTop: 4 }}>{event.body}</p>
                <p className="muted" style={{ marginTop: 6 }}>
                  {event.venue} · {new Date(event.startsAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              </li>
            ))}
            {events.length === 0 ? <li className="muted">No event published.</li> : null}
          </ul>
        </section>

        <section className="card">
          <h2 style={{ fontSize: 18 }}>Announcements</h2>
          <ul className="list" style={{ marginTop: 12 }}>
            {notices.map((notice) => (
              <li key={notice.id} className="row" style={{ display: 'block' }}>
                <span className={notice.priority === 'URGENT' ? 'tag tagRed' : notice.priority === 'HIGH' ? 'tag tagGold' : 'tag tagPlain'}>
                  {notice.priority}
                </span>
                <strong style={{ display: 'block', marginTop: 8 }}>{notice.title}</strong>
                <p className="muted" style={{ marginTop: 4 }}>{notice.body}</p>
              </li>
            ))}
            {notices.length === 0 ? <li className="muted">No announcement published.</li> : null}
          </ul>
        </section>

        <section className="card">
          <h2 style={{ fontSize: 18 }}>Notifications</h2>
          <ul className="list" style={{ marginTop: 12 }}>
            {notifications.map((item) => (
              <li key={item.id} className="row">
                <span>
                  <strong style={{ display: 'block' }}>{item.title}</strong>
                  <span className="muted">{item.body}</span>
                </span>
                {item.readAt ? null : (
                  <button
                    type="button"
                    className="btn btnGhost btnSmall"
                    onClick={async () => {
                      await api(`/notifications/${item.id}/read`, { method: 'POST' });
                      setNotifications((current) =>
                        current.map((entry) => (entry.id === item.id ? { ...entry, readAt: new Date().toISOString() } : entry)),
                      );
                    }}
                  >
                    Mark read
                  </button>
                )}
              </li>
            ))}
            {notifications.length === 0 ? <li className="muted">Nothing yet.</li> : null}
          </ul>
        </section>
      </div>
    </main>
  );
}
