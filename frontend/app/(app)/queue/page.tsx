'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAsync, useCountdown, formatClock, formatDuration, relativeTime, statusLabel, STATUS_TONES } from '../../../lib/hooks';
import { meApi, queueApi } from '../../../lib/api/endpoints';
import { ApiError } from '../../../lib/api/client';
import { Badge, Button, Card, CardSkeleton, EmptyState, ErrorState, Progress, SectionHeading } from '../../../components/ui/kit';
import { PageHeader } from '../../../components/layout/app-shell';
import { useToast } from '../../../components/ui/toast';
import { useRealtimeEvent } from '../../../lib/realtime/realtime-context';
import type { QueueListItem, QueueTicketView } from '../../../lib/api/types';

export default function QueuePage() {
  const toast = useToast();
  const queues = useAsync(() => queueApi.list(), []);
  const active = useAsync(() => meApi.queueTicket(), []);

  const [ticket, setTicket] = useState<QueueTicketView | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (active.data?.ticket) setTicket(active.data.ticket);
  }, [active.data]);

  const ticketId = ticket?.ticket.id ?? null;

  useRealtimeEvent(ticketId ? `queue:${ticket?.ticket.queue_id}` : null, () => {
    if (!ticketId) return;
    queueApi
      .ticket(ticketId)
      .then((payload) => setTicket(payload.ticket))
      .catch(() => {});
  });

  const deadline = useCountdown(ticket?.check_in_deadline ?? null);

  const join = async (queue: QueueListItem) => {
    setBusy(queue.id);
    setError(null);
    try {
      // Joining is idempotent server-side; the API client adds an idempotency key.
      const response = await queueApi.join(queue.id, {});
      const payload = await queueApi.ticket(response.ticket.id);
      setTicket(payload.ticket);
      toast.success(`Ticket ${response.ticket.ticket_number}`, `Position ${response.ticket.position} for ${queue.room_name}.`);
      queues.reload();
    } catch (caught) {
      const message = caught instanceof ApiError ? (caught.firstError ?? caught.message) : 'Could not join that queue.';
      setError(message);
      toast.error('Could not join the queue', message);
    } finally {
      setBusy(null);
    }
  };

  const act = async (kind: 'check-in' | 'cancel' | 'navigating') => {
    if (!ticket) return;
    setBusy(kind);
    setError(null);
    try {
      if (kind === 'check-in') {
        const payload = await queueApi.checkIn(ticket.ticket.id, {});
        setTicket(payload.ticket);
        toast.success('Checked in', 'Wait near the room until staff admit you.');
      } else if (kind === 'navigating') {
        const payload = await queueApi.navigating(ticket.ticket.id);
        setTicket(payload.ticket);
        toast.info('The room is expecting you', 'Head over now.');
      } else {
        const payload = await queueApi.cancel(ticket.ticket.id);
        setTicket(payload.ticket);
        toast.info('Ticket cancelled');
      }
      queues.reload();
    } catch (caught) {
      const message = caught instanceof ApiError ? (caught.firstError ?? caught.message) : 'That action failed.';
      setError(message);
      toast.error('Action failed', message);
    } finally {
      setBusy(null);
    }
  };

  const sortedQueues = useMemo(
    () => [...(queues.data?.queues ?? [])].sort((a, b) => Number(b.is_active) - Number(a.is_active) || b.waiting - a.waiting),
    [queues.data],
  );

  const counts = ticket?.counts;

  return (
    <div>
      <PageHeader
        title="Room queues"
        description="Some rooms limit how many people may be inside at once. Take a ticket, watch your position, and check in when you arrive."
        actions={
          <Link href="/rooms">
            <Button variant="secondary" size="sm">
              Find a room
            </Button>
          </Link>
        }
      />

      {error ? (
        <div className="mb-4 rounded-[12px] border border-coral-200 bg-coral-50 px-4 py-2.5 text-[13px] text-coral-700">{error}</div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          {queues.error ? <ErrorState message={queues.error} onRetry={queues.reload} /> : null}
          {queues.loading ? (
            <CardSkeleton rows={5} />
          ) : sortedQueues.length === 0 ? (
            <EmptyState title="No queues are open" description="Admission-controlled rooms appear here whenever their queue is active." />
          ) : (
            sortedQueues.map((queue) => {
              const mine = ticket?.ticket.queue_id === queue.id;
              const load = queue.admission_capacity > 0 ? (queue.serving / queue.admission_capacity) * 100 : 0;
              return (
                <Card key={queue.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[15px] font-semibold text-ink-900">
                          {queue.room_code} · {queue.room_name}
                        </p>
                        {!queue.is_active ? <Badge tone="neutral">Closed</Badge> : null}
                        {queue.is_active && queue.waiting > 0 ? <Badge tone="warning">Busy</Badge> : null}
                      </div>
                      <p className="mt-0.5 text-[12.5px] text-ink-500">
                        {queue.building_code} · {queue.floor_name} · capacity {queue.room_capacity}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="tnum text-[20px] font-semibold text-ink-900">{queue.waiting}</p>
                      <p className="text-[11.5px] text-ink-500">in line</p>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[12px] text-ink-500">
                      <span>
{queue.serving} inside · {queue.admission_capacity} allowed · {queue.waiting} waiting
                      </span>
                      <span className="tnum">
                        {queue.opens_at ? `${queue.opens_at.slice(0, 5)}–${queue.closes_at?.slice(0, 5)}` : 'Always open'}
                      </span>
                    </div>
                    <div className="mt-1.5">
                      <Progress value={load} tone={load > 85 ? 'signal' : 'brand'} />
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[12.5px] text-ink-500">
                    <span>Average service {Math.round(queue.avg_service_seconds / 60)} min</span>
                    {queue.waiting > 0 ? <span>· ≈ {formatDuration(queue.waiting * queue.avg_service_seconds)} wait</span> : null}
                    {queue.requires_proximity_to_join ? <span>· proximity check required to join</span> : null}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {mine && ticket ? (
                      <Badge tone={STATUS_TONES[ticket.ticket.status] ?? 'brand'}>
                        Your ticket {ticket.ticket.ticket_number} · {statusLabel(ticket.ticket.status)}
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        disabled={!queue.is_active || ticket !== null}
                        loading={busy === queue.id}
                        onClick={() => void join(queue)}
                      >
                        {ticket ? 'You already hold a ticket' : queue.is_active ? 'Take a ticket' : 'Queue closed'}
                      </Button>
                    )}
                    <Link href={`/rooms/${queue.room_code}`}>
                      <Button size="sm" variant="secondary">
                        Room details
                      </Button>
                    </Link>
                    <Link href={`/navigate?to=${encodeURIComponent(queue.room_code)}`}>
                      <Button size="sm" variant="ghost">
                        Navigate
                      </Button>
                    </Link>
                  </div>
                </Card>
              );
            })
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <SectionHeading title="Your ticket" description={ticket ? undefined : 'No active ticket'} />
            {!ticket ? (
              <EmptyState title="Nothing in the line" description="Take a ticket from a room on the left and it will appear here with live position updates." />
            ) : (
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-2xl font-semibold tracking-wide text-ink-900">{ticket.ticket.ticket_number}</p>
                    <p className="mt-0.5 text-[12.5px] text-ink-500">
                      {ticket.queue.room_code} · {ticket.queue.room_name}
                    </p>
                  </div>
                  <Badge tone={STATUS_TONES[ticket.ticket.status] ?? 'brand'}>{statusLabel(ticket.ticket.status)}</Badge>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-[10px] bg-ink-50 px-2 py-2.5">
                    <p className="tnum text-[18px] font-semibold text-ink-900">{ticket.people_ahead}</p>
                    <p className="text-[11px] text-ink-500">people ahead</p>
                  </div>
                  <div className="rounded-[10px] bg-ink-50 px-2 py-2.5">
                    <p className="tnum text-[18px] font-semibold text-ink-900">{ticket.ticket.position}</p>
                    <p className="text-[11px] text-ink-500">your position</p>
                  </div>
                  <div className="rounded-[10px] bg-ink-50 px-2 py-2.5">
                    <p className="tnum text-[18px] font-semibold text-ink-900">{counts?.serving ?? counts?.occupying ?? 0}</p>
                    <p className="text-[11px] text-ink-500">inside now</p>
                  </div>
                </div>

                <div className="mt-4 rounded-[10px] border border-ink-100 px-3 py-2.5 text-[12.5px]">
                  <p className="text-ink-500">Estimated wait</p>
                  <p className="tnum font-medium text-ink-800">
                    {formatDuration(ticket.eta_seconds)}
                    {ticket.expected_service_at ? ` · around ${formatClock(ticket.expected_service_at)}` : ''}
                  </p>
                </div>

                {ticket.check_in_deadline && ticket.seconds_until_deadline !== null && ticket.can_check_in ? (
                  <div className="mt-3 rounded-[10px] border border-signal-200 bg-signal-50 px-3 py-2.5 text-[12.5px] text-signal-700">
                    Check in by {formatClock(ticket.check_in_deadline)}
                    {deadline !== null ? ` · ${formatDuration(Math.max(0, deadline))} left` : ''}
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  {ticket.can_check_in ? (
                    <Button className="flex-1" loading={busy === 'check-in'} onClick={() => void act('check-in')}>
                      Check in now
                    </Button>
                  ) : null}
                  {ticket.ticket.status === 'CALLED' || ticket.ticket.status === 'APPROACHING' ? (
                    <Button variant="signal" className="flex-1" loading={busy === 'navigating'} onClick={() => void act('navigating')}>
                      I am on my way
                    </Button>
                  ) : null}
                  {ticket.can_cancel ? (
                    <Button variant="secondary" onClick={() => void act('cancel')} loading={busy === 'cancel'}>
                      Cancel
                    </Button>
                  ) : null}
                </div>

                <p className="mt-3 text-[11.5px] text-ink-400">
                  Issued {relativeTime(ticket.ticket.issued_at)} · the server reserves your position until you leave the line.
                </p>
              </div>
            )}
          </Card>

          <Card>
            <SectionHeading title="How the queue protects your place" />
            <ul className="space-y-2 text-[12.5px] leading-relaxed text-ink-600">
              <li>• One active ticket per student per queue — taking two is rejected, not silently merged.</li>
              <li>• Positions are locked in the database, so two people can never hold the same place.</li>
              <li>• If you are called and do not check in within the window, the ticket expires and the next person moves up.</li>
              <li>• Ghost tickets are released automatically, and the line is renumbered without gaps.</li>
            </ul>
          </Card>

          {ticket ? (
            <Card>
              <SectionHeading title="People in front" description={`${ticket.counts.waiting} waiting`} />
              <p className="text-[12.5px] text-ink-500">
                {ticket.people_ahead > 0
                  ? `${ticket.people_ahead} ${ticket.people_ahead === 1 ? 'person is' : 'people are'} ahead of you.`
                  : 'You are next — stay close to the room.'}
              </p>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
