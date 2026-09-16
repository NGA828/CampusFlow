'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useAsync } from '@/lib/hooks';
import { queueApi, studentApi } from '@/lib/api/endpoints';
import { ApiError, newIdempotencyKey } from '@/lib/api/client';
import type { QueueListItem, QueueTicketView } from '@/lib/api/types';
import { useRealtime, useRealtimeEvent } from '@/lib/realtime/realtime-context';
import { Button, CardSkeleton, Input } from '@/components/ui/kit';
import { WorkspaceIcon } from '@/components/layout/workspace-visual';
import { CompanionHeading, Empty, Feedback, ReadError, errorMessage, momentLabel } from '@/components/layout/student-companion';
import s from '@/components/layout/student-companion.module.css';

const ACTIVE = new Set(['waiting', 'called', 'navigating', 'checked_in', 'admitted']);
const TERMINAL = new Set(['completed', 'cancelled', 'no_show']);
const GUIDANCE: Record<string, [string, string]> = {
  waiting: ['Waiting for your turn.', 'Keep your ticket number handy. The campus team will call your number when they are ready.'],
  called: ['Your number has been called.', 'Go to the room and follow the arrival instructions. Check the deadline below, if one is provided.'],
  navigating: ['You’re on your way.', 'Head to the room. Your arrival still needs to be confirmed.'],
  checked_in: ['Your arrival is confirmed.', 'Wait for the campus team to admit you. Check-in is not admission.'],
  admitted: ['You have been admitted.', 'The campus team will update this ticket when your visit is complete.'],
  completed: ['Your visit is complete.', 'This ticket is now a record of your visit. You can browse other queues below.'],
  cancelled: ['This ticket was cancelled.', 'It no longer holds a place in the line. You can join an available queue again.'],
  no_show: ['Your visit was missed.', 'This ticket no longer holds a place. Check room availability before joining again.'],
};
function locationFix(): Promise<Record<string, unknown>> {
  if (!navigator.geolocation) return Promise.reject(new Error('Location is not available in this browser. Use the campus mobile app at the room.'));
  return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(
    position => resolve({ lat: position.coords.latitude, lng: position.coords.longitude, accuracy_m: position.coords.accuracy, source: 'gps' }),
    () => reject(new Error('Location could not be obtained. Allow location access while at the room, then try again. No ticket action was sent.')),
    { timeout: 8000, maximumAge: 30_000, enableHighAccuracy: true },
  ));
}
function validView(value: QueueTicketView, id?: string) {
  if (!value?.ticket?.id || !value.queue?.id || (id && String(value.ticket.id) !== String(id))) throw new Error('The server did not confirm this ticket. Refresh to check its status.');
  return value;
}
const countLabel = (value?: number | null) => typeof value === 'number' && Number.isFinite(value) ? value : '—';

export default function QueuePage() {
  const { connected } = useRealtime();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<QueueTicketView | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [openOnly, setOpenOnly] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [feedback, setFeedback] = useState<{ error?: boolean; message: string } | null>(null);
  const lock = useRef(false);
  const joinKeys = useRef(new Map<string, string>());
  const queues = useAsync(() => studentApi.queueBoard(), []);
  const active = useAsync(async () => selectedId ? { ticket: validView(await queueApi.ticket(selectedId), selectedId) } : studentApi.activeQueueTicket(), [selectedId]);
  // A confirmed mutation wins over a previously-started read until an explicit subsequent refresh.
  const view = confirmed ?? active.data?.ticket;
  const ticketId = view?.ticket.id;
  const history = useAsync(() => ticketId ? queueApi.history(ticketId) : Promise.resolve({ events: [] }), [ticketId]);
  function refreshTicket() {
    if (lock.current) return;
    if (view?.ticket.id) setSelectedId(view.ticket.id);
    setConfirmed(undefined); active.reload(); history.reload();
  }
  function refreshBoard() { if (!lock.current) queues.reload(); }
  useRealtimeEvent('queue:*', () => { refreshBoard(); refreshTicket(); });
  const state = view?.ticket.status.toLowerCase() ?? '';
  const isLive = ACTIVE.has(state);
  const terminal = TERMINAL.has(state);
  const guidance = GUIDANCE[state] ?? ['Check the latest ticket state.', 'Refresh this ticket or ask the campus team for help with its current status.'];
  const rows = (queues.data?.queues ?? []).filter(queue => (!openOnly || queue.is_active) && `${queue.room_code} ${queue.room_name} ${queue.building_name ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()));

  async function join(queue: QueueListItem) {
    if (lock.current) return;
    lock.current = true; setBusy(`join:${queue.id}`); setFeedback(null);
    try {
      let key = joinKeys.current.get(queue.id);
      if (!key) { key = newIdempotencyKey('join'); joinKeys.current.set(queue.id, key); }
      const body = queue.requires_proximity_to_join ? { fix: await locationFix() } : {};
      const { ticket } = await queueApi.join(queue.id, body, key);
      const next = validView(ticket);
      if (String(next.queue.id) !== String(queue.id)) throw new Error('The returned ticket belongs to another queue. Refresh before retrying.');
      setSelectedId(next.ticket.id); setConfirmed(next); setConfirmCancel(false);
      joinKeys.current.delete(queue.id);
      setFeedback({ message: 'Your ticket is confirmed. Its latest state is shown in Your ticket.' });
      queues.reload(); history.reload();
    } catch (error) {
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) joinKeys.current.delete(queue.id);
      setFeedback({ error: true, message: errorMessage(error, 'Your ticket could not be confirmed. Refresh before retrying.') });
    } finally { lock.current = false; setBusy(null); }
  }
  async function selectTicket(id: string) {
    if (lock.current) return;
    lock.current = true; setBusy('open'); setFeedback(null);
    try { const next = validView(await queueApi.ticket(id), id); setSelectedId(id); setConfirmed(next); setConfirmCancel(false); }
    catch (error) { setFeedback({ error: true, message: errorMessage(error, 'That ticket could not be opened.') }); }
    finally { lock.current = false; setBusy(null); }
  }
  async function act(action: 'cancel' | 'checkIn' | 'navigating') {
    if (!view || lock.current) return;
    lock.current = true; setBusy(action); setFeedback(null);
    try {
      const body = action === 'checkIn' && view.queue.requires_proximity_to_join ? { fix: await locationFix() } : {};
      const next = validView(await (action === 'checkIn' ? queueApi.checkIn(view.ticket.id, body) : queueApi[action](view.ticket.id)), view.ticket.id);
      setConfirmed(next); setSelectedId(next.ticket.id); setConfirmCancel(false);
      setFeedback({ message: action === 'cancel' ? 'Your ticket was cancelled.' : action === 'checkIn' ? 'Your arrival was confirmed.' : 'The campus team knows you’re on your way.' });
      queues.reload(); history.reload();
    } catch (error) { setFeedback({ error: true, message: errorMessage(error, 'The ticket action could not be confirmed. Please try again.') }); }
    finally { lock.current = false; setBusy(null); }
  }

  return <div className={s.page}>
    <CompanionHeading eyebrow="Student services · room access" title="Room queues" description="Choose a room, check the line and keep your ticket close." actions={<Link href="/student/campus/rooms" className={s.link}>Browse all rooms <WorkspaceIcon name="arrow" size={17} /></Link>} />
    {feedback && <Feedback error={feedback.error}>{feedback.message}</Feedback>}
    <div className={s.queueLayout}>
      <aside className={s.ticketRail} aria-label="Your ticket" aria-busy={!confirmed && active.loading}>
        <div className={s.sectionHead}><h2>Your ticket</h2><Button variant="secondary" size="sm" disabled={!!busy || active.loading} onClick={refreshTicket}>Refresh ticket</Button></div>
        {!confirmed && active.loading ? <CardSkeleton rows={7} /> : !confirmed && active.error ? <ReadError message={active.error} retry={refreshTicket} /> : view ? <>
          <article className={s.ticket}>
            <div className={s.ticketTop}>
              <div className={s.sectionHead}><p className={s.eyebrow}>{terminal ? 'Ticket receipt' : 'Your room ticket'}</p><span className={s.status}>{state.replaceAll('_', ' ')}</span></div>
              <h2>{view.queue.room_name}</h2><p className={s.muted} style={{ color: '#d8e7de' }}>Room {view.queue.room_code} · {view.queue.floor_name ?? 'Floor not provided'}</p>
              <strong className={s.ticketNumber}>{view.ticket.ticket_number}</strong><p>Ticket number · issued {momentLabel(view.ticket.issued_at)}</p>
            </div>
            <div className={s.ticketBody}>
              {isLive && state !== 'admitted' && <dl className={s.facts}><div><dt>People ahead</dt><dd>{countLabel(view.people_ahead)}</dd></div><div><dt>Estimated wait</dt><dd>{Number.isFinite(view.eta_seconds) ? `${Math.ceil(view.eta_seconds / 60)} min` : 'Unavailable'}</dd></div></dl>}
              <h3>{guidance[0]}</h3><p className={s.muted}>{guidance[1]}</p>
              {isLive && <p className={s.connection}>Estimates can change; admission is not guaranteed.</p>}
              {isLive && view.check_in_deadline && <p className={s.feedback}>Arrival deadline: {momentLabel(view.check_in_deadline)}</p>}
              {!terminal && !view.can_check_in && ['waiting', 'called', 'navigating'].includes(state) && <p className={s.connection}>Web check-in is unavailable. Use the mobile app if required at the room.</p>}
              <div className={s.actions}>
                {view.can_check_in && ['waiting', 'called', 'navigating'].includes(state) && <Button disabled={!!busy || confirmCancel} loading={busy === 'checkIn'} onClick={() => void act('checkIn')}>{view.queue.requires_proximity_to_join ? 'Use location & check in' : 'Check in'}</Button>}
                {view.can_navigate && state === 'called' && <Button variant="secondary" disabled={!!busy || confirmCancel} loading={busy === 'navigating'} onClick={() => void act('navigating')}>I’m on my way</Button>}
                {view.can_cancel && !terminal && !confirmCancel && <Button variant="secondary" disabled={!!busy} onClick={() => setConfirmCancel(true)}>Cancel ticket</Button>}
              </div>
              {confirmCancel && <div className={s.confirm}><p>Cancel ticket {view.ticket.ticket_number}? This releases your place in the line.</p><div className={s.actions}><Button variant="danger" disabled={!!busy} loading={busy === 'cancel'} onClick={() => void act('cancel')}>Confirm cancellation</Button><Button variant="secondary" disabled={!!busy} onClick={() => setConfirmCancel(false)}>Keep ticket</Button></div></div>}
            </div>
          </article>
          <Link className={s.link} href={`/student/campus/rooms/${encodeURIComponent(view.queue.room_code)}`}>Room details <WorkspaceIcon name="arrow" size={16} /></Link>
          <details className={s.details}><summary>Ticket history</summary>{history.loading ? <CardSkeleton rows={3} /> : history.error ? <ReadError message={history.error} retry={history.reload} /> : history.data?.events.length ? <dl>{history.data.events.map((event, index) => <div key={`${event.type}-${event.created_at}-${index}`}><dt>{momentLabel(event.created_at)}</dt><dd>{event.type.replaceAll('_', ' ')}</dd></div>)}</dl> : <p className={s.muted}>No history events were returned for this ticket.</p>}</details>
        </> : <Empty title="No active room ticket">Choose an available queue below. A ticket is confirmed only after the campus system accepts your request.</Empty>}
        <p className={s.connection}>{connected ? 'Connected to campus updates. Refresh to confirm the latest ticket state.' : 'Live connection unavailable. Refresh your ticket to check for changes.'}</p>
      </aside>
      <section className={s.board} aria-label="Room queue board" aria-busy={queues.loading}>
        <div className={s.sectionHead}><h2>Find your room</h2><Button variant="secondary" size="sm" disabled={!!busy || queues.loading} onClick={refreshBoard}>Refresh board</Button></div>
        <div className={s.queueTools}><Input aria-label="Search room queues" placeholder="Search a room or building…" value={search} onChange={e => setSearch(e.target.value)} /><div><label className={s.muted}><input type="checkbox" checked={openOnly} onChange={e => setOpenOnly(e.target.checked)} /> Open queues only</label><span className={s.muted}>{queues.loading || queues.error ? 'Checking availability' : `${rows.length} ${rows.length === 1 ? 'queue' : 'queues'} shown`}</span></div></div>
        {queues.loading ? <CardSkeleton rows={8} /> : queues.error ? <ReadError message={queues.error} retry={refreshBoard} /> : rows.length ? <div className={s.queueList}>{rows.map(queue => {
          const isSelected = view?.queue.id === queue.id;
          const ownId = isSelected ? isLive ? view?.ticket.id : null : queue.my_ticket_id;
          const max = queue.max_capacity ?? queue.max_size;
          const full = max > 0 && queue.waiting + queue.serving >= max;
          return <article key={queue.id} className={s.queueRow}>
            <div className={s.queueIdentity}><span className={s.roomCode}><WorkspaceIcon name="room" size={22} /></span><div><h3>{queue.room_name}</h3><p>Room {queue.room_code} · {queue.building_name ?? queue.building_code} · {queue.floor_name}</p></div><span className={s.status} data-tone={!queue.is_active ? 'quiet' : full ? 'attention' : undefined}>{!queue.is_active ? 'Closed' : full ? 'Line at limit' : 'Open'}</span></div>
            <dl className={s.facts}><div><dt>Waiting</dt><dd>{countLabel(queue.waiting)}</dd></div><div><dt>Called / in service</dt><dd>{countLabel(queue.serving)}</dd></div><div><dt>Admission limit</dt><dd>{countLabel(queue.admission_capacity)}</dd></div></dl>
            <div className={s.queueFoot}><p>{queue.requires_proximity_to_join ? 'Location is required. Join while you’re near this room.' : 'You can request a ticket from here. Arrival requirements still apply.'}</p>{ownId ? <Button variant="secondary" disabled={!!busy} onClick={() => void selectTicket(ownId)}>View ticket · {queue.room_code}</Button> : <Button disabled={!!busy || !queue.is_active || full} loading={busy === `join:${queue.id}`} onClick={() => void join(queue)}>{queue.requires_proximity_to_join ? 'Use location & join' : 'Join queue'} · {queue.room_code}</Button>}</div>
          </article>;
        })}</div> : <Empty title={search || openOnly ? 'No queues match your filters' : 'No room queues available'}>{search || openOnly ? 'Try a different room name or show closed queues.' : 'Check back later or browse the room directory for more information.'}</Empty>}
      </section>
    </div>
  </div>;
}
