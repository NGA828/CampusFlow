'use client';

import { use, useCallback } from 'react';
import Link from 'next/link';
import { useAsync, formatClock, formatDuration, relativeTime, statusLabel, STATUS_TONES } from '@/lib/hooks';
import { staffApi } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { useRealtimeEvent } from '@/lib/realtime/realtime-context';
import { Badge, Button, Card, CardSkeleton, EmptyState, ErrorState, SectionHeading, Stat } from '@/components/ui/kit';
import { PageHeader } from '@/components/layout/app-shell';
import { useToast } from '@/components/ui/toast';

export default function StaffOfficePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const toast = useToast();
  const detail = useAsync(() => staffApi.officeLine(id), [id]);

  useRealtimeEvent(`office:${id}`, () => detail.reload(), []);
  useRealtimeEvent('staff:ops', () => detail.reload(), []);

  const run = useCallback(
    async (action: () => Promise<unknown>, message: string) => {
      try {
        await action();
        toast.success(message);
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
        <PageHeader title="Office console" breadcrumb={[{ label: 'Operations', href: '/staff/dashboard' }, { label: 'Office' }]} />
        <ErrorState message={detail.error} onRetry={detail.reload} />
      </div>
    );
  }

  if (detail.loading || !detail.data) {
    return (
      <div>
        <PageHeader title="Office console" breadcrumb={[{ label: 'Operations', href: '/staff/dashboard' }, { label: 'Office' }]} />
        <CardSkeleton rows={6} />
      </div>
    );
  }

  const { office, line, counts, windows } = detail.data;
  const waiting = line.filter((row) => ['REQUESTED', 'TICKET_ASSIGNED', 'WAITING', 'APPROACHING'].includes(row.status));
  const called = line.filter((row) => ['CALLED', 'CHECK_IN_WINDOW', 'CHECKED_IN'].includes(row.status));
  const inService = line.filter((row) => row.status === 'IN_SERVICE');
  const todayWindows = windows.filter((window) => window.is_active);

  return (
    <div>
      <PageHeader
        title={office.name}
        description={`${office.building_code} · ${office.floor_name}${office.room_code ? ` · ${office.room_code}` : ''} · ${office.concurrent_capacity} students served at once`}
        breadcrumb={[{ label: 'Operations', href: '/staff/dashboard' }, { label: office.name }]}
        actions={
          <>
            <Link href="/staff">
              <Button variant="secondary" size="sm">
                All scopes
              </Button>
            </Link>
            <Button size="sm" onClick={() => void run(() => staffApi.officeCallNext(id), 'Next ticket called')}>
              Call next
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Waiting" value={String(counts.waiting)} />
        <Stat label="Checked in" value={String(counts.checked_in)} tone={counts.checked_in > 0 ? 'brand' : 'default'} />
        <Stat label="In service" value={String(counts.in_service)} hint={`capacity ${office.concurrent_capacity}`} />
        <Stat label="Served today" value={String(office.completed_today)} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Card>
            <SectionHeading title="Called & in service" description="Stages that need you now" />
            {called.length === 0 && inService.length === 0 ? (
              <EmptyState title="Nobody is at the desk" description="Call the next ticket when you are ready for the next student." />
            ) : (
              <ul className="space-y-2">
                {[...inService, ...called].map((row) => (
                  <li key={row.id} className="rounded-[12px] border border-ink-100 px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-[13.5px] font-semibold text-ink-900">
                          <span className="font-mono">{row.ticket_number}</span>
                          <Badge tone={STATUS_TONES[row.status] ?? 'neutral'}>{statusLabel(row.status)}</Badge>
                        </p>
                        <p className="mt-0.5 text-[12.5px] text-ink-500">
                          {row.student_name} · {row.subject ?? 'no subject'} · waited {formatDuration(row.wait_seconds)}
                          {row.check_in_deadline && !row.checked_in ? ` · check in by ${formatClock(row.check_in_deadline)}` : ''}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {!row.checked_in ? (
                          <Button size="sm" variant="signal" onClick={() => void run(() => staffApi.officeCheckIn(row.id), `${row.ticket_number} checked in`)}>
                            Desk check-in
                          </Button>
                        ) : null}
                        {row.checked_in && row.status !== 'IN_SERVICE' ? (
                          <Button size="sm" onClick={() => void run(() => staffApi.officeStartService(row.id), `Serving ${row.ticket_number}`)}>
                            Start service
                          </Button>
                        ) : null}
                        <Button size="sm" variant="secondary" onClick={() => void run(() => staffApi.officeComplete(row.id), `${row.ticket_number} completed`)}>
                          Complete
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => void run(() => staffApi.officeNoShow(row.id, 'Marked at the desk'), `${row.ticket_number} marked no-show`)}>
                          No-show
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <SectionHeading title="Waiting list" description={`${waiting.length} tickets awaiting their turn`} />
            {waiting.length === 0 ? (
              <p className="text-[13px] text-ink-500">The line is empty.</p>
            ) : (
              <ul className="divide-y divide-ink-50">
                {waiting.map((row) => (
                  <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-[13px]">
                        <span className="font-mono font-medium text-ink-800">{row.ticket_number}</span>
                        <span className="text-ink-500">#{row.position}</span>
                        <Badge tone={STATUS_TONES[row.status] ?? 'neutral'}>{statusLabel(row.status)}</Badge>
                      </p>
                      <p className="text-[12px] text-ink-500">
                        {row.student_name} · requested {relativeTime(row.requested_at)}
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => void run(() => staffApi.officeCallNext(id), 'Called the next ticket')}>
                      Call next
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <SectionHeading title="Today's service windows" />
            {todayWindows.length === 0 ? (
              <p className="text-[13px] text-ink-500">No window is configured for today — tickets cannot be issued outside service hours.</p>
            ) : (
              <ul className="space-y-2">
                {todayWindows.map((window) => (
                  <li key={window.id} className="flex items-center justify-between rounded-[10px] bg-ink-50 px-3 py-2 text-[12.5px]">
                    <span className="tnum font-medium text-ink-700">
                      {window.opens_at.slice(0, 5)} – {window.closes_at.slice(0, 5)}
                    </span>
                    <span className="tnum text-ink-500">
                      cap {window.capacity} · {window.avg_service_minutes} min
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <SectionHeading title="Desk policy" />
            <ul className="space-y-2 text-[12.5px] leading-relaxed text-ink-600">
              <li>• Tickets are issued with the prefix <span className="font-mono">{office.ticket_prefix}</span>.</li>
              <li>• Check-in is verified within {office.check_in_radius_m} m of the office.</li>
              <li>• Completing a ticket records the service duration, which feeds the rolling average students see.</li>
              <li>• No-shows free the slot immediately and are counted in the analytics dashboard.</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
