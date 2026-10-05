'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError, api, isSignedOut } from '@/lib/api';
import { useRequireRole } from '@/lib/session';
import type { Booking, RoomSummary } from '@/lib/types';

function defaultSlot(): { startsAt: string; endsAt: string } {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(10, 0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const local = (value: Date) => new Date(value.getTime() - value.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  return { startsAt: local(start), endsAt: local(end) };
}

export default function StudentRoomsPage() {
  const { user, loading } = useRequireRole('STUDENT');
  const [rooms, setRooms] = useState<RoomSummary[] | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [form, setForm] = useState(() => ({ roomId: '', purpose: '', ...defaultSlot() }));
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const payload = await api<{ items: Booking[] }>('/bookings');
    setBookings(payload.items);
  }, []);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      try {
        const [roomPayload] = await Promise.all([api<{ items: RoomSummary[] }>('/rooms'), refresh()]);
        setRooms(roomPayload.items);
        setForm((current) => ({ ...current, roomId: roomPayload.items.find((room) => room.bookable)?.id ?? '' }));
      } catch (caught) {
        if (isSignedOut(caught)) return;
        setError('Rooms could not be loaded.');
      }
    })();
  }, [user, refresh]);

  if (loading || !user) {
    return (
      <main className="shell" style={{ paddingBlock: 40 }}>
        <div className="skeleton" style={{ maxWidth: 280, height: 26 }} />
      </main>
    );
  }

  const bookable = (rooms ?? []).filter((room) => room.bookable);

  return (
    <main className="shell" style={{ paddingBlock: 36 }}>
      <p className="eyebrow">Facilities</p>
      <h1 style={{ marginTop: 8 }}>Rooms & administrative bookings</h1>
      <p className="muted" style={{ marginTop: 8, maxWidth: 720 }}>
        Browse every mapped room, and request one of the administrative rooms for a meeting or an interview. The scolarité
        approves or declines — the request is never auto-confirmed.
      </p>

      {error ? <p className="notice noticeError" style={{ marginTop: 14 }}>{error}</p> : null}
      {ok ? <p className="notice noticeOk" style={{ marginTop: 14 }}>{ok}</p> : null}

      <div className="grid" style={{ gridTemplateColumns: 'minmax(300px, 420px) 1fr', marginTop: 20, alignItems: 'start' }}>
        <form
          className="card"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setError(null);
            setOk(null);
            try {
              await api('/bookings', {
                method: 'POST',
                body: {
                  roomId: form.roomId,
                  purpose: form.purpose.trim(),
                  startsAt: new Date(form.startsAt).toISOString(),
                  endsAt: new Date(form.endsAt).toISOString(),
                },
              });
              setOk('Request sent. You will be notified when the scolarité decides.');
              setForm((current) => ({ ...current, purpose: '' }));
              await refresh();
            } catch (caught) {
              setError(caught instanceof ApiError ? caught.message : 'Your request could not be sent.');
            } finally {
              setBusy(false);
            }
          }}
        >
          <p className="eyebrow">New request</p>
          <h2 style={{ marginTop: 6, fontSize: 18 }}>Book a meeting or interview room</h2>
          <label className="field" style={{ marginTop: 12 }}>
            <span>Room</span>
            <select required value={form.roomId} onChange={(event) => setForm({ ...form, roomId: event.target.value })}>
              {bookable.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.code} — {room.name} ({room.capacity} places)
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Purpose</span>
            <textarea
              required
              minLength={6}
              value={form.purpose}
              onChange={(event) => setForm({ ...form, purpose: event.target.value })}
              placeholder="Entretien de suivi de stage avec le Bureau des Stages"
            />
          </label>
          <label className="field">
            <span>From</span>
            <input type="datetime-local" required value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} />
          </label>
          <label className="field">
            <span>Until</span>
            <input type="datetime-local" required value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} />
          </label>
          <button type="submit" className="btn" style={{ width: '100%' }} disabled={busy || !form.roomId}>
            {busy ? 'Sending…' : 'Send request'}
          </button>
        </form>

        <div className="grid" style={{ gap: 16 }}>
          <section className="card">
            <p className="eyebrow">Your requests</p>
            <ul className="list" style={{ marginTop: 12 }}>
              {bookings.length === 0 ? <li className="muted">No request yet.</li> : null}
              {bookings.map((booking) => (
                <li key={booking.id} className="row">
                  <span>
                    <strong style={{ display: 'block' }}>{booking.room?.name ?? 'Room'}</strong>
                    <span className="muted">
                      {new Date(booking.startsAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })} · {booking.purpose}
                    </span>
                    {booking.decisionNote ? <span className="muted" style={{ display: 'block' }}>Note: {booking.decisionNote}</span> : null}
                  </span>
                  <span style={{ display: 'grid', gap: 6, justifyItems: 'end' }}>
                    <span
                      className={
                        booking.status === 'APPROVED' ? 'tag tagGreen' : booking.status === 'DECLINED' ? 'tag tagRed' : booking.status === 'CANCELLED' ? 'tag tagPlain' : 'tag tagGold'
                      }
                    >
                      {booking.status}
                    </span>
                    {booking.status === 'PENDING' || booking.status === 'APPROVED' ? (
                      <button
                        type="button"
                        className="btn btnGhost btnSmall"
                        onClick={async () => {
                          await api(`/bookings/${booking.id}/cancel`, { method: 'POST' });
                          await refresh();
                        }}
                      >
                        Cancel
                      </button>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="card">
            <p className="eyebrow">Campus facilities</p>
            <ul className="list scroller" style={{ marginTop: 12 }}>
              {(rooms ?? []).map((room) => (
                <li key={room.id} className="row">
                  <span>
                    <strong style={{ display: 'block' }}>{room.code} — {room.name}</strong>
                    <span className="muted">{room.buildingName} · {room.floorName} · {room.capacity} places</span>
                  </span>
                  <span className={room.bookable ? 'tag tagGreen' : 'tag tagPlain'}>{room.bookable ? 'Bookable' : room.kind}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </main>
  );
}
