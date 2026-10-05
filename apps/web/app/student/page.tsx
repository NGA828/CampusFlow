'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, isSignedOut } from '@/lib/api';
import { useRequireRole } from '@/lib/session';
import type { Announcement, Booking, CampusEvent, NotificationItem } from '@/lib/types';

function when(value: string): string {
  return new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function StudentHome() {
  const { user, loading } = useRequireRole('STUDENT');
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[] | null>(null);
  const [events, setEvents] = useState<CampusEvent[] | null>(null);
  const [notices, setNotices] = useState<Announcement[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      try {
        const [bookingPayload, notificationPayload, eventPayload, noticePayload] = await Promise.all([
          api<{ items: Booking[] }>('/bookings'),
          api<{ items: NotificationItem[] }>('/notifications'),
          api<{ items: CampusEvent[] }>(`/events?university=${user.universitySlug}`),
          api<{ items: Announcement[] }>(`/announcements?university=${user.universitySlug}`),
        ]);
        setBookings(bookingPayload.items);
        setNotifications(notificationPayload.items);
        setEvents(eventPayload.items);
        setNotices(noticePayload.items);
      } catch (caught) {
        if (isSignedOut(caught)) return;
        setError('Your campus data could not be loaded. Refresh to try again.');
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

  const upcoming = (bookings ?? []).filter((booking) => booking.status !== 'CANCELLED' && Date.parse(booking.endsAt) > Date.now());
  const unread = (notifications ?? []).filter((item) => !item.readAt);

  return (
    <main className="shell" style={{ paddingBlock: 36 }}>
      <p className="eyebrow">Student workspace · {user.universitySlug === 'iai-cameroun' ? 'IAI Cameroun' : user.universitySlug}</p>
      <h1 style={{ marginTop: 8 }}>Bonjour, {user.name.split(' ')[0]}.</h1>
      <p className="muted" style={{ marginTop: 8 }}>
        {user.matricule ? `Matricule ${user.matricule} · ` : ''}
        {unread.length > 0 ? `${unread.length} unread notification${unread.length > 1 ? 's' : ''}` : 'Nothing unread right now'}
      </p>

      {error ? (
        <p className="notice noticeError" style={{ marginTop: 16 }}>
          {error}
        </p>
      ) : null}

      <div className="grid cols3" style={{ marginTop: 22 }}>
        <Link href="/student/map" className="card" style={{ textDecoration: 'none' }}>
          <p className="eyebrow">Navigate</p>
          <h3 style={{ marginTop: 6 }}>Campus map & indoor routes</h3>
          <p className="muted" style={{ marginTop: 6 }}>Scan a QR anchor, then follow a step-by-step route to any room.</p>
        </Link>
        <Link href="/student/rooms" className="card" style={{ textDecoration: 'none' }}>
          <p className="eyebrow">Book</p>
          <h3 style={{ marginTop: 6 }}>Rooms & administrative meetings</h3>
          <p className="muted" style={{ marginTop: 6 }}>Request an interview or meeting room and track the decision.</p>
        </Link>
        <Link href="/student/campus-life" className="card" style={{ textDecoration: 'none' }}>
          <p className="eyebrow">Follow</p>
          <h3 style={{ marginTop: 6 }}>Events, notices & notifications</h3>
          <p className="muted" style={{ marginTop: 6 }}>Everything published by your institution, newest first.</p>
        </Link>
      </div>

      <div className="grid cols2" style={{ marginTop: 20 }}>
        <section className="card">
          <p className="eyebrow">Your requests</p>
          <h2 style={{ marginTop: 6, fontSize: 20 }}>Upcoming appointments</h2>
          {bookings === null ? (
            <div className="skeleton" style={{ marginTop: 14 }} />
          ) : upcoming.length === 0 ? (
            <p className="muted" style={{ marginTop: 12 }}>
              No upcoming appointment. <Link href="/student/rooms">Request a room</Link>.
            </p>
          ) : (
            <ul className="list" style={{ marginTop: 12 }}>
              {upcoming.map((booking) => (
                <li key={booking.id} className="row">
                  <span>
                    <strong style={{ display: 'block' }}>{booking.room?.name ?? 'Room'}</strong>
                    <span className="muted">
                      {booking.room?.buildingName} · {booking.room?.floorName} · {when(booking.startsAt)}
                    </span>
                  </span>
                  <span
                    className={
                      booking.status === 'APPROVED' ? 'tag tagGreen' : booking.status === 'DECLINED' ? 'tag tagRed' : 'tag tagGold'
                    }
                  >
                    {booking.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <p className="eyebrow">Inbox</p>
          <h2 style={{ marginTop: 6, fontSize: 20 }}>Notifications</h2>
          {notifications === null ? (
            <div className="skeleton" style={{ marginTop: 14 }} />
          ) : notifications.length === 0 ? (
            <p className="muted" style={{ marginTop: 12 }}>Nothing yet.</p>
          ) : (
            <ul className="list" style={{ marginTop: 12 }}>
              {notifications.slice(0, 5).map((item) => (
                <li key={item.id} className="row">
                  <span>
                    <strong style={{ display: 'block' }}>{item.title}</strong>
                    <span className="muted">{item.body}</span>
                  </span>
                  {item.readAt ? null : <span className="tag">NEW</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid cols2" style={{ marginTop: 20 }}>
        <section className="card">
          <p className="eyebrow">Campus life</p>
          <h2 style={{ marginTop: 6, fontSize: 20 }}>Next events</h2>
          <ul className="list" style={{ marginTop: 12 }}>
            {(events ?? []).slice(0, 3).map((event) => (
              <li key={event.id} className="row">
                <span>
                  <strong style={{ display: 'block' }}>{event.title}</strong>
                  <span className="muted">{event.venue} · {when(event.startsAt)}</span>
                </span>
              </li>
            ))}
            {events?.length === 0 ? <li className="muted">No event published.</li> : null}
          </ul>
        </section>
        <section className="card">
          <p className="eyebrow">From the administration</p>
          <h2 style={{ marginTop: 6, fontSize: 20 }}>Latest notices</h2>
          <ul className="list" style={{ marginTop: 12 }}>
            {(notices ?? []).slice(0, 3).map((notice) => (
              <li key={notice.id} className="row">
                <span>
                  <strong style={{ display: 'block' }}>{notice.title}</strong>
                  <span className="muted">{notice.body}</span>
                </span>
                <span className={notice.priority === 'URGENT' ? 'tag tagRed' : notice.priority === 'HIGH' ? 'tag tagGold' : 'tag tagPlain'}>
                  {notice.priority}
                </span>
              </li>
            ))}
            {notices?.length === 0 ? <li className="muted">No announcement published.</li> : null}
          </ul>
        </section>
      </div>
    </main>
  );
}
