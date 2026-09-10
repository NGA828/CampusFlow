'use client';

import { use, useCallback } from 'react';
import Link from 'next/link';
import { useAsync, formatDuration, formatClock, relativeTime, statusLabel, STATUS_TONES } from '../../../../../lib/hooks';
import { staffApi } from '../../../../../lib/api/endpoints';
import { ApiError } from '../../../../../lib/api/client';
import { useRealtimeEvent } from '../../../../../lib/realtime/realtime-context';
import { Badge, Button, Card, CardSkeleton, EmptyState, ErrorState, SectionHeading, Stat } from '../../../../../components/ui/kit';
import { PageHeader } from '../../../../../components/layout/app-shell';
import { useToast } from '../../../../../components/ui/toast';

export default function StaffQueuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const toast = useToast();
  const detail = useAsync(() => staffApi.queueLine(id), [id]);

  useRealtimeEvent(`queue:${id}`, () => detail.reload(), []);
  useRealtimeEvent('staff:ops', () => detail.reload(), []);

  const run = useCallback(
    async (action: () => Promise<unknown>, successMessage: string) => {
      try {
        await action();
        toast.success(successMessage);
        detail.reload();
      } catch (caught) {
        toast.error('Action failed', caught instanceof ApiError ? (caught.firstError ?? caught.message) : 'Please try again.');
      }
    },
    [detail, toast],
  );

  if (detail.error) {
    return (
      <div>
        <PageHeader title="Queue console" breadcrumb={[{ label: 'Operations', href: '/staff' }, { label: 'Queue' }]} />
        <ErrorState message={detail.error} onRetry={detail.reload} />
      </div>
    );
  }

  if (detail.loading || !detail.data) {
    return (
      <div>
        <PageHeader title="Queue console" breadcrumb={[{ label: 'Operations', href: '/staff' }, { label: 'Queue' }]} />
        <CardSkeleton rows={6} />
      </div>
    );
  }

  const { queue, line, counts } = detail.data;
  const nextInLine = line.find((row) => row.status === 'WAITING' || row.status === 'QUEUE_PENDING');
  const active = line.filter((row) => row.status !== 'COMPLETED' && row.status !== 'CANCELLED' && row.status !== 'EXPIRED' && row.status !== 'NO_SHOW');

  return (
    <div>
      <PageHeader
        title={`${queue.room_code} queue`}
        description={`${queue.room_name} · ${queue.building_code}, ${queue.floor_name} · admission capacity ${queue.admission_capacity}`}
        breadcrumb={[{ label: 'Operations', href: '/staff' }, { label: `${queue.room_code} queue` }]}
        actions={
          <>
            <Link href="/staff">
              <Button variant="secondary" size="sm">
                All scopes
              </Button>
            </Link>
            <Button size="sm" loading={false} onClick={() => void run(() => staffApi.callNext(id), 'Next student called')}>
              Call next
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Waiting" value={String(counts.waiting ?? queue.waiting)} />
        <Stat label="Inside" value={String(queue.occupying)} tone={queue.occupying >= queue.admission_capacity ? 'warning' : 'default'} hint={`capacity ${queue.admission_capacity}`} />
        <Stat label="Checked in" value={String(queue.checked_in)} />
        <Stat label="Avg service" value={`${Math.round(queue.avg_service_seconds / 60)} min`} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card>
          <SectionHeading title="Line" description={`${active.length} active tickets`} />
          {active.length === 0 ? (
            <EmptyState title="Nobody is in the line" description="New tickets appear here the moment a student joins." />
          ) : (
            <ul className="space-y-2">
              {active.map((row) => (
                <li key={row.id} className="rounded-[12px] border border-ink-100 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-[13.5px] font-semibold text-ink-900">
                        <span className="font-mono">{row.ticket_number}</span>
                        <Badge tone={STATUS_TONES[row.status] ?? 'neutral'}>{statusLabel(row.status)}</Badge>
                        {row.checked_in ? <Badge tone="success">checked in</Badge> : null}
                      </p>
                      <p className="mt-0.5 text-[12.5px] text-ink-500">
                        {row.student_name} · position {row.position} · issued {relativeTime(row.issued_at)}
                        {row.check_in_deadline && row.status === 'CALLED' ? ` · check-in by ${formatClock(row.check_in_deadline)}` : ''}
                      </p>
                      <p className="mt-0.5 text-[12px] text-ink-400">
                        waited {formatDuration(row.wait_seconds)}
                        {row.eta_seconds !== null ? ` · student ETA ${formatDuration(row.eta_seconds)}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {!row.checked_in && row.status !== 'CALLED' ? (
                        <Button size="sm" variant="secondary" onClick={() => void run(() => staffApi.callNext(id), 'Called next — desk check-in is also available')}>
                          Call next
                        </Button>
                      ) : null}
                      {row.status === 'CHECKED_IN' || row.checked_in ? (
                        <Button size="sm" onClick={() => void run(() => staffApi.admit(row.id), `${row.ticket_number} admitted`)}>
                          Admit
                        </Button>
                      ) : (
                        <Button size="sm" variant="signal" onClick={() => void run(() => staffApi.staffCheckIn(row.id), `${row.ticket_number} checked in at the desk`)}>
                          Desk check-in
                        </Button>
                      )}
                      <Button size="sm" variant="secondary" onClick={() => void run(() => staffApi.complete(row.id), `${row.ticket_number} completed`)}>
                        Complete
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => void run(() => staffApi.noShow(row.id, 'Marked at the desk'), `${row.ticket_number} marked no-show`)}>
                        No-show
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <SectionHeading title="Next up" />
            {nextInLine ? (
              <div>
                <p className="font-mono text-xl font-semibold text-ink-900">{nextInLine.ticket_number}</p>
                <p className="mt-0.5 text-[13px] text-ink-600">{nextInLine.student_name}</p>
                <p className="mt-0.5 text-[12.5px] text-ink-500">
                  position {nextInLine.position} · waiting {formatDuration(nextInLine.wait_seconds)}
                </p>
                <Button className="mt-3 w-full" onClick={() => void run(() => staffApi.callNext(id), 'Next student called')}>
                  Call next student
                </Button>
              </div>
            ) : (
              <p className="text-[13px] text-ink-500">The line is empty — the next student to join will appear here.</p>
            )}
          </Card>

          <Card>
            <SectionHeading title="Queue settings" />
            <dl className="space-y-2 text-[12.5px]">
              <div className="flex justify-between">
                <dt className="text-ink-500">Queue state</dt>
                <dd className="text-ink-700">{queue.is_active ? 'Accepting tickets' : 'Closed'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-500">Maximum line</dt>
                <dd className="tnum text-ink-700">{queue.max_size}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-500">Proximity to join</dt>
                <dd className="text-ink-700">{queue.requires_proximity_to_join ? `${queue.proximity_radius_m} m` : 'Not required'}</dd>
              </div>
            </dl>
            <p className="mt-3 text-[11.5px] leading-relaxed text-ink-400">
              Calling, admitting and completing a ticket are recorded with your staff account and generate notifications for the student.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
