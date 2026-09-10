'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAsync, formatClock, formatDuration, relativeTime, STATUS_TONES, statusLabel } from '../../../../../lib/hooks';
import { officeApi } from '../../../../../lib/api/endpoints';
import { ApiError } from '../../../../../lib/api/client';
import { Badge, Button, Card, CardSkeleton, ErrorState, KeyValue, SectionHeading } from '../../../../../components/ui/kit';
import { PageHeader } from '../../../../../components/layout/app-shell';
import { useToast } from '../../../../../components/ui/toast';
import type { OfficeTicketView } from '../../../../../lib/api/types';

const EVENT_LABELS: Record<string, string> = {
  REQUESTED: 'Ticket requested',
  ASSIGNED: 'Queued in line',
  APPROACHING: 'You signalled you are on the way',
  CALLED: 'Called to the desk',
  CHECK_IN_WINDOW: 'Check-in window open',
  CHECKED_IN: 'Checked in at the office',
  IN_SERVICE: 'Service started',
  COMPLETED: 'Service completed',
  CANCELLED: 'Ticket cancelled',
  NO_SHOW: 'Marked as no-show',
  EXPIRED: 'Check-in window expired',
};

export default function OfficeTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const toast = useToast();

  const ticket = useAsync(() => officeApi.ticket(id), [id]);
  const history = useAsync(() => officeApi.history(id), [id]);
  const [current, setCurrent] = useState<OfficeTicketView | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (ticket.data) setCurrent(ticket.data);
  }, [ticket.data]);

  const act = async (kind: 'cancel' | 'check-in' | 'approaching') => {
    setBusy(kind);
    try {
      if (kind === 'cancel') {
        const updated = await officeApi.cancel(id);
        setCurrent(updated);
        toast.info('Ticket cancelled');
      } else if (kind === 'check-in') {
        const updated = await officeApi.checkIn(id, {});
        setCurrent(updated);
        toast.success('Checked in');
      } else {
        const updated = await officeApi.approaching(id);
        setCurrent(updated.ticket);
        toast.info('The office knows you are on the way');
      }
      history.reload();
    } catch (caught) {
      toast.error('Action failed', caught instanceof ApiError ? (caught.firstError ?? caught.message) : 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  if (ticket.error) {
    return (
      <div>
        <PageHeader title="Office ticket" breadcrumb={[{ label: 'Offices', href: '/offices' }, { label: 'Ticket' }]} />
        <ErrorState message={ticket.error} onRetry={ticket.reload} />
      </div>
    );
  }

  if (ticket.loading || !current) {
    return (
      <div>
        <PageHeader title="Office ticket" breadcrumb={[{ label: 'Offices', href: '/offices' }, { label: 'Ticket' }]} />
        <CardSkeleton rows={5} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={`Ticket ${current.ticket.ticket_number}`}
        description={`${current.office.name} · requested ${relativeTime(current.ticket.requested_at)}`}
        breadcrumb={[{ label: 'Offices', href: '/offices' }, { label: current.office.name, href: `/offices/${current.office.code}` }, { label: current.ticket.ticket_number }]}
        actions={
          <Link href="/offices">
            <Button variant="secondary" size="sm">
              All offices
            </Button>
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-2xl font-semibold tracking-wide text-ink-900">{current.ticket.ticket_number}</p>
                <p className="mt-1 text-[13px] text-ink-600">{current.ticket.subject ?? 'No subject recorded'}</p>
                {current.ticket.notes ? <p className="mt-1 text-[12.5px] text-ink-500">{current.ticket.notes}</p> : null}
              </div>
              <Badge tone={STATUS_TONES[current.ticket.status] ?? 'neutral'}>{current.status_label}</Badge>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-[10px] bg-ink-50 px-3 py-2.5">
                <dt className="text-[11px] text-ink-500">People ahead</dt>
                <dd className="tnum text-[18px] font-semibold text-ink-900">{current.people_ahead}</dd>
              </div>
              <div className="rounded-[10px] bg-ink-50 px-3 py-2.5">
                <dt className="text-[11px] text-ink-500">Position</dt>
                <dd className="tnum text-[18px] font-semibold text-ink-900">{current.ticket.position}</dd>
              </div>
              <div className="rounded-[10px] bg-ink-50 px-3 py-2.5">
                <dt className="text-[11px] text-ink-500">Est. wait</dt>
                <dd className="tnum text-[18px] font-semibold text-ink-900">{formatDuration(current.eta_seconds)}</dd>
              </div>
              <div className="rounded-[10px] bg-ink-50 px-3 py-2.5">
                <dt className="text-[11px] text-ink-500">In service</dt>
                <dd className="tnum text-[18px] font-semibold text-ink-900">{current.counts.in_service}</dd>
              </div>
            </dl>

            {current.expected_window ? (
              <p className="mt-3 text-[13px] text-ink-600">
                Expected window{' '}
                <strong className="tnum font-semibold text-ink-800">
                  {formatClock(current.expected_window.starts_at)} – {formatClock(current.expected_window.ends_at)}
                </strong>
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              {current.can_check_in ? (
                <Button loading={busy === 'check-in'} onClick={() => void act('check-in')}>
                  Check in — I am at the office
                </Button>
              ) : null}
              {current.ticket.status === 'CALLED' || current.ticket.status === 'TICKET_ASSIGNED' ? (
                <Button variant="signal" loading={busy === 'approaching'} onClick={() => void act('approaching')}>
                  I am on my way
                </Button>
              ) : null}
              {current.can_cancel ? (
                <Button variant="secondary" loading={busy === 'cancel'} onClick={() => void act('cancel')}>
                  Cancel ticket
                </Button>
              ) : null}
              {current.office.room_code ? (
                <Link href={`/navigate?to=${encodeURIComponent(current.office.room_code)}`}>
                  <Button variant="ghost">Navigate to office</Button>
                </Link>
              ) : null}
            </div>
          </Card>

          <Card>
            <SectionHeading title="Ticket timeline" />
            {history.loading ? (
              <CardSkeleton rows={4} />
            ) : (history.data?.events.length ?? 0) === 0 ? (
              <p className="text-[13px] text-ink-500">No events recorded yet.</p>
            ) : (
              <ol className="relative space-y-4 border-l border-ink-100 pl-5">
                {history.data?.events.map((event, index) => (
                  <li key={`${event.type}-${event.created_at}-${index}`} className="relative">
                    <span className="absolute top-1.5 -left-[25px] h-2.5 w-2.5 rounded-full bg-brand-500 ring-4 ring-white" />
                    <p className="text-[13px] font-medium text-ink-800">{EVENT_LABELS[event.type] ?? event.type.replaceAll('_', ' ').toLowerCase()}</p>
                    <p className="text-[12px] text-ink-400">{relativeTime(event.created_at)}</p>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <SectionHeading title="Office" />
            <dl className="divide-y divide-ink-50">
              <KeyValue label="Name" value={current.office.name} />
              <KeyValue label="Code" value={<span className="font-mono">{current.office.code}</span>} />
              <KeyValue label="Building" value={current.office.building_code ?? '—'} />
              <KeyValue label="Room" value={current.office.room_code ?? '—'} />
              <KeyValue label="Concurrent service" value={`${current.office.concurrent_capacity} students`} mono />
              <KeyValue label="Service duration" value={`${current.office.service_duration_minutes} min`} mono />
            </dl>
          </Card>

          <Card>
            <SectionHeading title="What happens next" />
            <ul className="space-y-2 text-[12.5px] leading-relaxed text-ink-600">
              <li>• You will be notified as your turn approaches and again when you are called.</li>
              <li>• When called, check in from your phone — proximity is verified against the office.</li>
              <li>• If you miss the check-in window, the ticket expires and the next person moves up.</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
