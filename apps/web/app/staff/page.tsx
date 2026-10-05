'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError, api } from '@/lib/api';
import { useRequireRole } from '@/lib/session';
import type { Booking } from '@/lib/types';

/** Scolarité: decide the room requests students send. */
export default function StaffRequestsPage() {
  const { user, loading } = useRequireRole('STAFF', 'ADMIN');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [note, setNote] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const payload = await api<{ items: Booking[] }>('/bookings');
      setBookings(payload.items);
    } catch {
      setError('Requests could not be loaded.');
    }
  }, []);

  useEffect(() => {
    if (user) void refresh();
  }, [user, refresh]);

  if (loading || !user) {
    return (
      <main className="shell" style={{ paddingBlock: 40 }}>
        <div className="skeleton" style={{ maxWidth: 280, height: 26 }} />
      </main>
    );
  }

  const pending = bookings.filter((booking) => booking.status === 'PENDING');
  const decided = bookings.filter((booking) => booking.status !== 'PENDING');

  async function decide(id: string, status: 'APPROVED' | 'DECLINED') {
    setBusy(id);
    setError(null);
    try {
      await api(`/bookings/${id}/decision`, { method: 'POST', body: { status, note: note[id] ?? null } });
      await refresh();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'The decision could not be saved.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="shell" style={{ paddingBlock: 36 }}>
      <p className="eyebrow">Scolarité</p>
      <h1 style={{ marginTop: 8 }}>Room requests</h1>
      <p className="muted" style={{ marginTop: 8 }}>
        {pending.length} awaiting a decision · {decided.length} already decided. The student is notified either way.
      </p>
      {error ? <p className="notice noticeError" style={{ marginTop: 14 }}>{error}</p> : null}

      <section className="card" style={{ marginTop: 20 }}>
        <h2 style={{ fontSize: 18 }}>Awaiting decision</h2>
        <ul className="list" style={{ marginTop: 12 }}>
          {pending.length === 0 ? <li className="muted">Nothing pending.</li> : null}
          {pending.map((booking) => (
            <li key={booking.id} className="row" style={{ display: 'block' }}>
              <strong>{booking.room?.name}</strong>
              <p className="muted" style={{ marginTop: 4 }}>
                {booking.student?.name}
                {booking.student?.matricule ? ` · ${booking.student.matricule}` : ''} ·{' '}
                {new Date(booking.startsAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })} →{' '}
                {new Date(booking.endsAt).toLocaleTimeString('en-GB', { timeStyle: 'short' })}
              </p>
              <p style={{ marginTop: 6 }}>{booking.purpose}</p>
              <label className="field" style={{ marginTop: 10 }}>
                <span>Note to the student (optional)</span>
                <input
                  value={note[booking.id] ?? ''}
                  onChange={(event) => setNote({ ...note, [booking.id]: event.target.value })}
                  placeholder="Confirmé. Présentez-vous dix minutes avant."
                />
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn" disabled={busy === booking.id} onClick={() => void decide(booking.id, 'APPROVED')}>
                  Approve
                </button>
                <button type="button" className="btn btnGhost" disabled={busy === booking.id} onClick={() => void decide(booking.id, 'DECLINED')}>
                  Decline
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card" style={{ marginTop: 18 }}>
        <h2 style={{ fontSize: 18 }}>Decided</h2>
        <ul className="list" style={{ marginTop: 12 }}>
          {decided.length === 0 ? <li className="muted">No decision yet.</li> : null}
          {decided.map((booking) => (
            <li key={booking.id} className="row">
              <span>
                <strong style={{ display: 'block' }}>{booking.room?.name}</strong>
                <span className="muted">
                  {booking.student?.name} · {new Date(booking.startsAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                </span>
              </span>
              <span className={booking.status === 'APPROVED' ? 'tag tagGreen' : booking.status === 'DECLINED' ? 'tag tagRed' : 'tag tagPlain'}>
                {booking.status}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
