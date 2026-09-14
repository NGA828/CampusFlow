'use client';

import Link from 'next/link';
import { useAsync, formatClock, formatDuration, relativeTime, statusLabel, STATUS_TONES, dayShort } from '@/lib/hooks';
import { studentApi } from '@/lib/api/endpoints';
import { useAuth } from '@/lib/auth/auth-context';
import { useRealtimeEvent } from '@/lib/realtime/realtime-context';
import {
  Badge,
  Button,
  Card,
  CardSkeleton,
  EmptyState,
  ErrorState,
  Progress,
  SectionHeading,
  Stat,
} from '@/components/ui/kit';
import { PageHeader } from '@/components/layout/app-shell';
import type { QuickAction } from '@/lib/api/types';

export default function DashboardPage() {
  const { user } = useAuth();
  const dashboard = useAsync(() => studentApi.dashboard(), []);
  const queues = useAsync(() => studentApi.queueBoard(), []);

  useRealtimeEvent(user ? `user:${user.id}` : null, () => dashboard.reload(), []);

  if (dashboard.loading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Dashboard" description="Loading your day…" />
        <CardSkeleton rows={4} />
        <CardSkeleton rows={3} />
      </div>
    );
  }

  if (dashboard.error) {
    return (
      <div>
        <PageHeader title="Dashboard" />
        <ErrorState message={dashboard.error} onRetry={dashboard.reload} />
      </div>
    );
  }

  const data = dashboard.data;
  if (!data) return null;

  const nextClass = data.next_class;
  const queueTicket = data.queue_ticket;
  const officeTicket = data.office_ticket;
  const myQueues = (queues.data?.queues ?? []).filter((queue) => queue.waiting > 0 || queue.my_ticket_id).slice(0, 3);
  const remaining = data.today.entries.filter((entry) => !isPast(entry)).length;

  return (
    <div>
      <PageHeader
        title={`Good ${greeting()}, ${data.user.name.split(' ')[0]}`}
        description={`${new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })} · ${remaining === 0 ? 'no more classes today' : `${remaining} class${remaining === 1 ? '' : 'es'} left today`}`}
        // The action strip is not hard-coded: the server returns the verbs this principal may perform
        // on this platform, so a browser never grows a scanner button and a phone never grows a console.
        actions={<QuickActions actions={data.quick_actions} />}
      />

      {data.building_alerts.length > 0 ? (
        <div className="mb-4 space-y-2">
          {data.building_alerts.map((alert) => (
            <div key={alert.id} className="flex items-center gap-2.5 rounded-[12px] border border-signal-200 bg-signal-50 px-4 py-2.5 text-[13px] text-signal-700">
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 9v4M12 16.5v.5M10.3 3.9L2.5 18a2 2 0 001.7 3h15.6a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" strokeLinecap="round" />
              </svg>
              <span>
                <strong className="font-semibold">{alert.name}</strong> is currently marked “{alert.status}”. Routes may change.
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Next class */}
          <Card>
            <SectionHeading
              title="Up next"
              description={nextClass ? `Starts ${relativeTime(nextClass.starts_at_iso)}` : 'Nothing further scheduled today'}
            />
            {nextClass ? (
              <div className="rounded-[12px] border border-ink-100 bg-gradient-to-br from-brand-50/70 to-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <span className="tnum inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[12px] font-medium text-brand-700 ring-1 ring-brand-100">
                      {formatClock(nextClass.starts_at_iso)} – {formatClock(nextClass.ends_at_iso)}
                      {nextClass.minutes_until !== null ? ` · in ${nextClass.minutes_until} min` : ''}
                    </span>
                    <h3 className="mt-2.5 text-[17px] font-semibold text-ink-900">
                      {nextClass.course_code} · {nextClass.course_title}
                    </h3>
                    <p className="mt-1 text-[13.5px] text-ink-600">
                      {nextClass.session_type} · {nextClass.lecturer ?? 'TBA'}
                    </p>
                    <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[13px] text-ink-700">
                      <span className="font-medium">{nextClass.room_code ?? 'Room TBA'}</span>
                      {nextClass.building_name ? <span className="text-ink-500">· {nextClass.building_name}</span> : null}
                      {nextClass.floor_name ? <span className="text-ink-500">· {nextClass.floor_name}</span> : null}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {nextClass.room_code ? (
                      <Link href={`/student/campus/map?route=${encodeURIComponent(nextClass.room_code)}`}>
                        <Button size="sm" className="w-full">
                          Navigate there
                        </Button>
                      </Link>
                    ) : null}
                    {nextClass.room_id ? (
                      <Link href={`/student/campus/rooms/${nextClass.room_code ?? nextClass.room_id}`}>
                        <Button variant="secondary" size="sm" className="w-full">
                          Room details
                        </Button>
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState title="No classes left today" description="Check tomorrow in your timetable, or browse rooms that are free right now." />
            )}
          </Card>

          {/* Today timeline */}
          <Card>
            <SectionHeading title="Today" description={`${data.today.entries.length} scheduled sessions`} />
            {data.today.entries.length === 0 ? (
              <EmptyState title="A clear day" description="There are no classes on your timetable for today." />
            ) : (
              <ol className="relative space-y-3 border-l border-ink-100 pl-5">
                {data.today.entries.map((entry) => (
                  <li key={entry.id} className="relative">
                    <span
                      className={`absolute top-2 -left-[25px] h-2.5 w-2.5 rounded-full ring-4 ring-white ${entry.is_now ? 'bg-mint-500' : isPast(entry) ? 'bg-ink-300' : 'bg-brand-500'}`}
                    />
                    <div className={`rounded-[12px] border px-4 py-3 ${entry.is_now ? 'border-mint-200 bg-mint-50/60' : 'border-ink-100'}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[13.5px] font-medium text-ink-800">
                          {entry.course_code} · {entry.course_title}
                        </p>
                        <span className="tnum text-[12.5px] text-ink-500">
                          {formatClock(entry.starts_at_iso)}–{formatClock(entry.ends_at_iso)}
                        </span>
                      </div>
                      <p className="mt-1 text-[12.5px] text-ink-500">
                        {entry.room_code ?? 'Room TBA'}
                        {entry.building_code ? ` · Building ${entry.building_code}` : ''} · {entry.session_type}
                        {entry.is_now ? ' · happening now' : ''}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          {/* Active room ticket */}
          <Card>
            <SectionHeading title="Room queue" description="Your active admission ticket" />
            {queueTicket ? (
              <div className="rounded-[12px] border border-ink-100 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="tnum font-mono text-xl font-semibold text-ink-900">{queueTicket.ticket.ticket_number}</p>
                    <p className="mt-0.5 text-[12.5px] text-ink-500">
                      {queueTicket.queue.room_code} · {queueTicket.queue.room_name}
                    </p>
                  </div>
                  <Badge tone={STATUS_TONES[queueTicket.ticket.status] ?? 'neutral'}>{statusLabel(queueTicket.ticket.status)}</Badge>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-[12.5px]">
                  <div>
                    <dt className="text-ink-500">People ahead</dt>
                    <dd className="tnum font-semibold text-ink-800">{queueTicket.people_ahead}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-500">Estimated wait</dt>
                    <dd className="tnum font-semibold text-ink-800">{formatDuration(queueTicket.eta_seconds)}</dd>
                  </div>
                </dl>
                <Link href="/student/services/queues" className="mt-3 block">
                  <Button variant="secondary" size="sm" className="w-full">
                    Open queue ticket
                  </Button>
                </Link>
              </div>
            ) : (
              <EmptyState
                title="No active ticket"
                description="Join a room queue when you need a controlled seat — most rooms also allow unplanned visits."
                action={
                  <Link href="/student/services/queues">
                    <Button size="sm" variant="secondary">
                      Browse queues
                    </Button>
                  </Link>
                }
              />
            )}
          </Card>

          {/* Active office ticket */}
          <Card>
            <SectionHeading title="Administrative office" description="Your latest service ticket" />
            {officeTicket ? (
              <div className="rounded-[12px] border border-ink-100 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="tnum font-mono text-xl font-semibold text-ink-900">{officeTicket.ticket.ticket_number}</p>
                    <p className="mt-0.5 text-[12.5px] text-ink-500">{officeTicket.office.name}</p>
                  </div>
                  <Badge tone={STATUS_TONES[officeTicket.ticket.status] ?? 'neutral'}>{officeTicket.status_label}</Badge>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-[12.5px]">
                  <div>
                    <dt className="text-ink-500">People ahead</dt>
                    <dd className="tnum font-semibold text-ink-800">{officeTicket.people_ahead}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-500">Estimated wait</dt>
                    <dd className="tnum font-semibold text-ink-800">{formatDuration(officeTicket.eta_seconds)}</dd>
                  </div>
                </dl>
                <Link href={`/student/services/offices/${officeTicket.office.id}`} className="mt-3 block">
                  <Button variant="secondary" size="sm" className="w-full">
                    Open office ticket
                  </Button>
                </Link>
              </div>
            ) : (
              <EmptyState
                title="No office ticket"
                description="Request a ticket for the Principal's Office, Student Affairs, the Dean, the Registrar or the Secretary."
                action={
                  <Link href="/student/services/offices">
                    <Button size="sm" variant="secondary">
                      Browse offices
                    </Button>
                  </Link>
                }
              />
            )}
          </Card>

          {/* Queues with movement */}
          {myQueues.length > 0 ? (
            <Card>
              <SectionHeading title="Busy rooms right now" />
              <ul className="space-y-3">
                {myQueues.map((queue) => {
                  const capacity = Math.max(1, queue.max_size);
                  return (
                    <li key={queue.id}>
                      <div className="flex items-center justify-between text-[13px]">
                        <span className="font-medium text-ink-800">
                          {queue.room_code} · {queue.room_name}
                        </span>
                        <span className="tnum text-ink-500">{queue.waiting} waiting</span>
                      </div>
                      <div className="mt-1.5">
                        <Progress value={(queue.waiting / capacity) * 100} tone={queue.waiting / capacity > 0.75 ? 'signal' : 'brand'} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ) : null}

          {/* Notifications + announcements */}
          <Card>
            <SectionHeading
              title="Notifications"
              description={data.unread_notifications > 0 ? `${data.unread_notifications} unread` : 'You are all caught up'}
              action={
                <Link href="/notifications" className="text-[12.5px] font-medium text-brand-600 hover:text-brand-700">
                  View all
                </Link>
              }
            />
            {data.notifications.length === 0 ? (
              <p className="text-[13px] text-ink-500">Queue calls, class reminders and announcements appear here.</p>
            ) : (
              <ul className="space-y-3">
                {data.notifications.slice(0, 3).map((notification) => (
                  <li key={notification.id} className="rounded-[12px] border border-ink-100 px-3.5 py-3">
                    <p className="text-[13px] font-medium text-ink-800">{notification.title}</p>
                    <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-500">{notification.body}</p>
                    <p className="mt-1 text-[11.5px] text-ink-400">{relativeTime(notification.created_at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <div className="grid grid-cols-2 gap-4">
            <Stat label="Week sessions" value={data.today.entries.length} hint={`Term ${new Date().getFullYear()}`} />
            <Stat
              label="Unread"
              value={data.unread_notifications}
              tone={data.unread_notifications > 0 ? 'brand' : 'default'}
              hint="notifications"
            />
          </div>
        </div>
      </div>

      {/* Announcements + events */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionHeading
            title="Campus announcements"
            action={
              <Link href="/student/announcements" className="text-[12.5px] font-medium text-brand-600 hover:text-brand-700">
                All notices
              </Link>
            }
          />
          {data.announcements.length === 0 ? (
            <p className="text-[13px] text-ink-500">No announcements have been published.</p>
          ) : (
            <ul className="space-y-3">
              {data.announcements.map((announcement) => (
                <li key={announcement.id} className="rounded-[12px] border border-ink-100 px-3.5 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[13.5px] font-medium text-ink-800">{announcement.title}</p>
                    {announcement.priority !== 'normal' ? (
                      <Badge tone={announcement.priority === 'urgent' ? 'danger' : 'warning'}>{announcement.priority}</Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-ink-500">{announcement.body}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <SectionHeading
            title="Upcoming events"
            action={
              <Link href="/student/campus/events" className="text-[12.5px] font-medium text-brand-600 hover:text-brand-700">
                All events
              </Link>
            }
          />
          {data.events.length === 0 ? (
            <p className="text-[13px] text-ink-500">Nothing on the calendar yet.</p>
          ) : (
            <ul className="space-y-3">
              {data.events.map((event) => (
                <li key={event.id} className="flex items-start gap-3 rounded-[12px] border border-ink-100 px-3.5 py-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-brand-50 text-brand-700">
                    <span className="text-[11px] font-semibold uppercase">{dayShort(new Date(event.starts_at).getDay() || 7)}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-medium text-ink-800">{event.title}</p>
                    <p className="mt-0.5 text-[12.5px] text-ink-500">
                      {formatClock(event.starts_at)}
                      {event.venue ? ` · ${event.venue}` : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

/**
 * Renders `data.quick_actions` from `/student/dashboard`.
 *
 * The hrefs and labels are chosen server-side from the role+platform permission registry
 * (`StudentDashboardController::quickActions`), which is what keeps the web dashboard from inheriting
 * mobile-only verbs such as scanning or live navigation.
 */
function QuickActions({ actions }: { actions: QuickAction[] }) {
  if (actions.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {actions.slice(0, 3).map((action, index) => (
        <Link key={action.id} href={action.href}>
          <Button variant={index === 0 ? 'primary' : 'secondary'} size="sm">
            {action.label}
          </Button>
        </Link>
      ))}
    </div>
  );
}

function isPast(entry: { ends_at_iso: string }): boolean {
  return new Date(entry.ends_at_iso).getTime() < Date.now();
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}
