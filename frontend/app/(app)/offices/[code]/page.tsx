'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useAsync, formatClock, formatDuration, relativeTime, STATUS_TONES, statusLabel } from '../../../../lib/hooks';
import { meApi, officeApi } from '../../../../lib/api/endpoints';
import { ApiError } from '../../../../lib/api/client';
import { Badge, Button, Card, CardSkeleton, EmptyState, ErrorState, Field, KeyValue, SectionHeading, Textarea } from '../../../../components/ui/kit';
import { PageHeader } from '../../../../components/layout/app-shell';
import { useToast } from '../../../../components/ui/toast';
import type { OfficeTicketView } from '../../../../lib/api/types';

export default function OfficeDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  return (
    <Suspense fallback={<CardSkeleton rows={6} />}>
      <OfficeDetail code={code} />
    </Suspense>
  );
}

function OfficeDetail({ code }: { code: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();

  const office = useAsync(() => officeApi.detail(code), [code]);
  const active = useAsync(() => meApi.officeTicket(), []);

  const [subject, setSubject] = useState('');
  const [notes, setNotes] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<OfficeTicketView | null>(null);
  const [showForm, setShowForm] = useState(params.get('request') === '1');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (active.data?.ticket) setTicket(active.data.ticket);
  }, [active.data]);

  const request = async () => {
    if (!office.data) return;
    setRequesting(true);
    setFormError(null);
    try {
      const issued = await officeApi.request(office.data.office.id, { subject: subject.trim(), notes: notes.trim() || undefined });
      setTicket(issued);
      setShowForm(false);
      toast.success(`Ticket ${issued.ticket.ticket_number} requested`, 'We will call you when the office is ready.');
      router.replace(`/offices/${code}`);
    } catch (caught) {
      const message = caught instanceof ApiError ? (caught.firstError ?? caught.message) : 'Could not request a ticket.';
      setFormError(message);
      toast.error('Request failed', message);
    } finally {
      setRequesting(false);
    }
  };

  const act = async (kind: 'cancel' | 'check-in' | 'approaching') => {
    if (!ticket) return;
    setBusy(kind);
    try {
      if (kind === 'cancel') {
        const updated = await officeApi.cancel(ticket.ticket.id);
        setTicket(updated);
        toast.info('Ticket cancelled');
      } else if (kind === 'check-in') {
        const updated = await officeApi.checkIn(ticket.ticket.id, {});
        setTicket(updated);
        toast.success('Checked in at the office');
      } else {
        const updated = await officeApi.approaching(ticket.ticket.id);
        setTicket(updated.ticket);
        toast.info('The office knows you are on your way');
      }
    } catch (caught) {
      const message = caught instanceof ApiError ? (caught.firstError ?? caught.message) : 'That action failed.';
      toast.error('Action failed', message);
    } finally {
      setBusy(null);
    }
  };

  if (office.error) {
    return (
      <div>
        <PageHeader title="Office" breadcrumb={[{ label: 'Offices', href: '/offices' }, { label: code }]} />
        <ErrorState message={office.error} onRetry={office.reload} />
      </div>
    );
  }

  if (office.loading || !office.data) {
    return (
      <div>
        <PageHeader title="Office" breadcrumb={[{ label: 'Offices', href: '/offices' }, { label: code }]} />
        <CardSkeleton rows={6} />
      </div>
    );
  }

  const summary = office.data;
  const { office: details } = summary;
  const status = summary.is_open_now ? 'Open now' : summary.next_opening ? `Opens ${relativeTime(summary.next_opening)}` : 'Closed';

  return (
    <div>
      <PageHeader
        title={details.name}
        description={details.description ?? 'Administrative office'}
        breadcrumb={[{ label: 'Offices', href: '/offices' }, { label: details.code }]}
        actions={
          <>
            {details.room_code || details.building_code ? (
              <Link href={`/navigate?to=${encodeURIComponent(details.room_code ?? details.building_code ?? '')}`}>
                <Button variant="secondary" size="sm">
                  Navigate
                </Button>
              </Link>
            ) : null}
            {!ticket ? (
              <Button size="sm" onClick={() => setShowForm(true)}>
                Request a ticket
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {ticket ? (
            <Card className="border-brand-200 bg-gradient-to-br from-brand-50/70 to-white">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[12.5px] font-medium text-brand-700">Your ticket</p>
                  <p className="font-mono text-3xl font-semibold tracking-wide text-ink-900">{ticket.ticket.ticket_number}</p>
                  <p className="mt-1 text-[13px] text-ink-600">{ticket.ticket.subject ?? 'No subject recorded'}</p>
                </div>
                <Badge tone={STATUS_TONES[ticket.ticket.status] ?? 'brand'}>{ticket.status_label}</Badge>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-[10px] bg-white/80 px-3 py-2.5">
                  <dt className="text-[11px] text-ink-500">People ahead</dt>
                  <dd className="tnum text-[17px] font-semibold text-ink-900">{ticket.people_ahead}</dd>
                </div>
                <div className="rounded-[10px] bg-white/80 px-3 py-2.5">
                  <dt className="text-[11px] text-ink-500">Your position</dt>
                  <dd className="tnum text-[17px] font-semibold text-ink-900">{ticket.ticket.position}</dd>
                </div>
                <div className="rounded-[10px] bg-white/80 px-3 py-2.5">
                  <dt className="text-[11px] text-ink-500">Estimated wait</dt>
                  <dd className="tnum text-[17px] font-semibold text-ink-900">{formatDuration(ticket.eta_seconds)}</dd>
                </div>
                <div className="rounded-[10px] bg-white/80 px-3 py-2.5">
                  <dt className="text-[11px] text-ink-500">In service</dt>
                  <dd className="tnum text-[17px] font-semibold text-ink-900">{ticket.counts.in_service}</dd>
                </div>
              </dl>

              {ticket.expected_window ? (
                <p className="mt-3 text-[13px] text-ink-600">
                  Expected service window{' '}
                  <strong className="tnum font-semibold text-ink-800">
                    {formatClock(ticket.expected_window.starts_at)} – {formatClock(ticket.expected_window.ends_at)}
                  </strong>
                  {ticket.ticket.check_in_deadline && ticket.seconds_until_deadline !== null ? (
                    <span className="ml-1 text-signal-600">
                      · check in by {formatClock(ticket.ticket.check_in_deadline)}
                    </span>
                  ) : null}
                </p>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                {ticket.can_check_in ? (
                  <Button loading={busy === 'check-in'} onClick={() => void act('check-in')}>
                    Check in (I am here)
                  </Button>
                ) : null}
                {ticket.ticket.status === 'CALLED' || ticket.ticket.status === 'TICKET_ASSIGNED' ? (
                  <Button variant="signal" loading={busy === 'approaching'} onClick={() => void act('approaching')}>
                    I am on my way
                  </Button>
                ) : null}
                {ticket.can_cancel ? (
                  <Button variant="secondary" loading={busy === 'cancel'} onClick={() => void act('cancel')}>
                    Cancel ticket
                  </Button>
                ) : null}
                <Link href={`/offices/tickets/${ticket.ticket.id}`}>
                  <Button variant="ghost">Ticket history</Button>
                </Link>
              </div>
            </Card>
          ) : showForm ? (
            <Card>
              <SectionHeading title="Request a ticket" description={`You will be number ${summary.next_ticket_number} in today's line.`} />
              <div className="space-y-4">
                <Field label="What do you need?" htmlFor="subject" error={formError} hint="A short phrase helps the office prepare, e.g. “Enrolment correction”.">
                  <Textarea
                    id="subject"
                    rows={2}
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    placeholder="Reason for your visit"
                  />
                </Field>
                <Field label="Anything else they should know? (optional)" htmlFor="notes">
                  <Textarea id="notes" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Registration number, document, etc." />
                </Field>
                <div className="flex gap-2">
                  <Button loading={requesting} onClick={() => void request()} disabled={subject.trim().length < 3}>
                    Confirm request
                  </Button>
                  <Button variant="secondary" onClick={() => setShowForm(false)}>
                    Cancel
                  </Button>
                </div>
                <p className="text-[12px] text-ink-500">
                  A ticket reserves your place in line. If you cannot make it in time, check in late or cancel — the next person moves up either way.
                </p>
              </div>
            </Card>
          ) : (
            <Card>
              <SectionHeading title="Today at this office" description={summary.is_open_now ? `Open ${summary.opens_at?.slice(0, 5)} – ${summary.closes_at?.slice(0, 5)}` : status} />
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-[12px] text-ink-500">Waiting</p>
                  <p className="tnum text-[20px] font-semibold text-ink-900">{summary.counts.waiting}</p>
                </div>
                <div>
                  <p className="text-[12px] text-ink-500">Est. wait</p>
                  <p className="tnum text-[20px] font-semibold text-ink-900">{formatDuration(summary.estimated_wait_minutes * 60)}</p>
                </div>
                <div>
                  <p className="text-[12px] text-ink-500">Next number</p>
                  <p className="font-mono text-[20px] font-semibold text-ink-900">{summary.next_ticket_number}</p>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Button onClick={() => setShowForm(true)}>Request a ticket</Button>
                {details.room_code ? (
                  <Link href={`/navigate?to=${encodeURIComponent(details.room_code)}`}>
                    <Button variant="secondary">Directions</Button>
                  </Link>
                ) : null}
              </div>
            </Card>
          )}

          <Card>
            <SectionHeading title="Queue right now" description={`${summary.today_in_line.length} tickets issued today`} />
            {summary.today_in_line.length === 0 ? (
              <EmptyState title="The line is empty" description="Walk in — you will be served as soon as the office is ready." />
            ) : (
              <div className="flex flex-wrap gap-2">
                {summary.today_in_line.slice(0, 24).map((row) => (
                  <span
                    key={`${row.position}-${row.status}`}
                    className={`tnum rounded-[8px] border px-2 py-1 text-[12px] ${
                      row.status === 'IN_SERVICE' ? 'border-mint-200 bg-mint-50 text-mint-700' : row.status === 'CALLED' || row.status === 'CHECK_IN_WINDOW' ? 'border-signal-200 bg-signal-50 text-signal-700' : 'border-ink-200 text-ink-500'
                    }`}
                  >
                    #{row.position} · {statusLabel(row.status)}
                  </span>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <SectionHeading title="Service windows" description="The office only issues tickets inside these hours." />
            {summary.windows.length === 0 ? (
              <p className="text-[13px] text-ink-500">No service windows are configured for this office.</p>
            ) : (
              <ul className="divide-y divide-ink-50">
                {summary.windows.map((window) => (
                  <li key={window.id} className="flex items-center justify-between py-2 text-[12.5px]">
                    <span className="font-medium text-ink-700">{['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][window.day_of_week - 1] ?? 'Day'}</span>
                    <span className="tnum text-ink-600">
                      {window.opens_at.slice(0, 5)} – {window.closes_at.slice(0, 5)}
                    </span>
                    <span className="tnum text-ink-400">cap {window.capacity} · {window.avg_service_minutes} min</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <SectionHeading title="Office details" />
            <dl className="divide-y divide-ink-50">
              <KeyValue label="Ticket prefix" value={<span className="font-mono">{details.ticket_prefix}</span>} />
              <KeyValue label="Concurrent service" value={`${details.concurrent_capacity} students`} mono />
              <KeyValue label="Check-in radius" value={`${details.check_in_radius_m} m`} mono />
              <KeyValue label="Service duration" value={`${details.service_duration_minutes} min`} mono />
              <KeyValue label="Building" value={details.building_code ?? '—'} />
              <KeyValue label="Room" value={details.room_code ?? '—'} />
            </dl>
          </Card>

          <Card>
            <SectionHeading title="Today's staff" />
            {summary.staff.length === 0 ? (
              <p className="text-[13px] text-ink-500">No staff are assigned for today.</p>
            ) : (
              <ul className="space-y-2">
                {summary.staff.map((member) => (
                  <li key={member.id} className="flex items-center justify-between text-[13px]">
                    <span className="font-medium text-ink-800">{member.name}</span>
                    <Badge tone="neutral">{member.role}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <SectionHeading title="Good to know" />
            <ul className="space-y-2 text-[12.5px] leading-relaxed text-ink-600">
              <li>• Tickets are numbered like <span className="font-mono">P-024</span> so staff can call you by number.</li>
              <li>• You are notified when your turn approaches and again when you are called.</li>
              <li>• Check-in is verified against the office location — no need to queue physically before your turn.</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
