'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useAsync, formatDuration, relativeTime, STATUS_TONES, statusLabel } from '@/lib/hooks';
import { studentApi } from '@/lib/api/endpoints';
import { Badge, Button, Card, CardSkeleton, EmptyState, ErrorState, KeyValue, SectionHeading } from '@/components/ui/kit';
import { PageHeader } from '@/components/layout/app-shell';

export default function OfficesPage() {
  const summaries = useAsync(() => studentApi.offices(), []);
  const history = useAsync(() => studentApi.officeTickets(), []);
  const [filter, setFilter] = useState<'all' | 'open'>('all');

  const offices = useMemo(() => {
    const list = [...(summaries.data?.offices ?? [])];
    list.sort((a, b) => Number(b.is_open_now) - Number(a.is_open_now) || a.office.name.localeCompare(b.office.name));
    return filter === 'open' ? list.filter((office) => office.is_open_now) : list;
  }, [summaries.data, filter]);

  return (
    <div>
      <PageHeader
        title="Administrative offices"
        description="Request a ticket before you walk over. CampusFlow shows the line, the expected service window and calls you when it is your turn."
        actions={
          <div className="flex items-center gap-2">
            <Button variant={filter === 'all' ? 'secondary' : 'ghost'} size="sm" onClick={() => setFilter('all')}>
              All
            </Button>
            <Button variant={filter === 'open' ? 'secondary' : 'ghost'} size="sm" onClick={() => setFilter('open')}>
              Open now
            </Button>
          </div>
        }
      />

      {summaries.error ? <ErrorState message={summaries.error} onRetry={summaries.reload} /> : null}

      {summaries.loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <CardSkeleton rows={4} />
          <CardSkeleton rows={4} />
        </div>
      ) : offices.length === 0 ? (
        <EmptyState
          title={filter === 'open' ? 'No offices are open right now' : 'No offices configured'}
          description="Service windows are set by the administration — check back during working hours."
          action={
            filter === 'open' ? (
              <Button variant="secondary" size="sm" onClick={() => setFilter('all')}>
                Show all offices
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {offices.map((summary) => {
            const { office } = summary;
            return (
              <Card key={office.id} className="flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-ink-900">{office.name}</p>
                    <p className="mt-0.5 text-[12.5px] text-ink-500">
                      {office.building_code ? `Building ${office.building_code}` : '—'}
                      {office.floor_name ? ` · ${office.floor_name}` : ''}
                      {office.room_code ? ` · ${office.room_code}` : ''}
                    </p>
                  </div>
                  <Badge tone={summary.is_open_now ? 'success' : 'neutral'}>{summary.is_open_now ? 'Open now' : 'Closed'}</Badge>
                </div>

                <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-[10px] bg-ink-50 px-2 py-2.5">
                    <p className="tnum text-[17px] font-semibold text-ink-900">{summary.counts.waiting}</p>
                    <p className="text-[11px] text-ink-500">waiting</p>
                  </div>
                  <div className="rounded-[10px] bg-ink-50 px-2 py-2.5">
                    <p className="tnum text-[17px] font-semibold text-ink-900">{summary.counts.in_service}</p>
                    <p className="text-[11px] text-ink-500">in service</p>
                  </div>
                  <div className="rounded-[10px] bg-ink-50 px-2 py-2.5">
                    <p className="tnum text-[17px] font-semibold text-ink-900">{summary.average_service_minutes}</p>
                    <p className="text-[11px] text-ink-500">min avg</p>
                  </div>
                </dl>

                <dl className="mt-3 divide-y divide-ink-50">
                  <KeyValue
                    label="Next number"
                    value={<span className="font-mono">{summary.next_ticket_number}</span>}
                  />
                  <KeyValue
                    label="Estimated wait"
                    value={summary.is_open_now ? formatDuration(summary.estimated_wait_minutes * 60) : summary.next_opening ? `Opens ${relativeTime(summary.next_opening)}` : '—'}
                  />
                  {summary.expected_window ? (
                    <KeyValue
                      label="Expected window"
                      value={`${summary.expected_window.starts_at.slice(11, 16)} – ${summary.expected_window.ends_at.slice(11, 16)}`}
                      mono
                    />
                  ) : null}
                  {summary.daily_capacity ? (
                    <KeyValue label="Daily capacity" value={`${summary.daily_capacity_used} / ${summary.daily_capacity}`} mono />
                  ) : null}
                </dl>

                {summary.staff.length > 0 ? (
                  <p className="mt-3 text-[12px] text-ink-500">
                    Served by {summary.staff.map((staff) => staff.name).join(', ')}
                  </p>
                ) : null}

                <div className="mt-auto flex flex-wrap gap-2 pt-4">
                  <Link href={`/student/services/offices/${office.code}`}>
                    <Button size="sm" variant="secondary">
                      Details
                    </Button>
                  </Link>
                  <Link href={`/student/services/offices/${office.code}?request=1`}>
                    <Button size="sm">Get a ticket</Button>
                  </Link>
                  {office.building_code ? (
                    <Link href={`/student/campus/map?route=${encodeURIComponent(office.room_code ?? office.building_code)}`}>
                      <Button size="sm" variant="ghost">
                        Navigate
                      </Button>
                    </Link>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="mt-4">
        <SectionHeading title="Your recent office tickets" description="Every request you have made, newest first." />
        {history.loading ? (
          <CardSkeleton rows={3} />
        ) : (history.data?.tickets.length ?? 0) === 0 ? (
          <p className="text-[13px] text-ink-500">You have not requested an office ticket yet.</p>
        ) : (
          <ul className="divide-y divide-ink-50">
            {history.data?.tickets.slice(0, 8).map((ticket) => (
              <li key={ticket.ticket.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-mono text-[13px] font-medium text-ink-800">{ticket.ticket.ticket_number}</p>
                  <p className="truncate text-[12.5px] text-ink-500">
                    {ticket.office.name} · {ticket.ticket.subject ?? 'No subject'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[12px] text-ink-400">{relativeTime(ticket.ticket.requested_at)}</span>
                  <Badge tone={STATUS_TONES[ticket.ticket.status] ?? 'neutral'}>{statusLabel(ticket.ticket.status)}</Badge>
                  <Link href={`/student/services/offices/tickets/${ticket.ticket.id}`}>
                    <Button size="sm" variant="ghost">
                      Open
                    </Button>
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
