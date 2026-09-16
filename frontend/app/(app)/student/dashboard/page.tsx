"use client";
import Image from "next/image";
import Link from "next/link";
import { useAsync, statusLabel, formatClock, dayShort } from "@/lib/hooks";
import { studentApi } from "@/lib/api/endpoints";
import { useAuth } from "@/lib/auth/auth-context";
import { useRealtimeEvent } from "@/lib/realtime/realtime-context";
import { assistantWebHref } from "@/lib/companion-links";
import { Badge, Button, CardSkeleton } from "@/components/ui/kit";
import { ReadError, momentLabel } from "@/components/layout/student-companion";
import type { TimetableEntry } from "@/lib/api/types";
import s from "@/components/layout/campus-operations.module.css";
function clock(v?: string) {
  if (!v) return "Time TBA";
  return /^\d{2}:\d{2}/.test(v)
    ? v.slice(0, 5)
    : Number.isFinite(Date.parse(v))
      ? formatClock(v)
      : "Time TBA";
}
function classTime(c: TimetableEntry) {
  return `${clock(c.starts_at || c.starts_at_iso)} – ${clock(c.ends_at || c.ends_at_iso)}`;
}
function dateLabel(value?: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00`).toLocaleDateString("en", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : "Your published schedule";
}
export default function DashboardPage() {
  const { user } = useAuth();
  const dashboard = useAsync(() => studentApi.dashboard(), []);
  const queues = useAsync(() => studentApi.queueBoard(), []);
  useRealtimeEvent(
    user ? `user:${user.id}` : null,
    () => {
      dashboard.reload();
      queues.reload();
    },
    [],
  );
  const data = dashboard.data;
  const next = data?.next_class;
  const room = data?.queue_ticket;
  const office = data?.office_ticket;
  return (
    <div className={s.page}>
      <header className={s.heading}>
        <div>
          <p className={s.eyebrow}>Your campus / daily planner</p>
          <h1>
            {data ? `Hello, ${data.user.name.split(" ")[0]}.` : "Dashboard"}
          </h1>
          <p>
            {dateLabel(data?.today.date)} · One place for your next class and
            next step.
          </p>
        </div>
        <Button
          variant="secondary"
          disabled={dashboard.loading}
          onClick={() => {
            dashboard.reload();
            queues.reload();
          }}
        >
          Refresh my day
        </Button>
      </header>
      {dashboard.error ? (
        <ReadError message={dashboard.error} retry={dashboard.reload} />
      ) : dashboard.loading || !data ? (
        <CardSkeleton rows={6} />
      ) : (
        <>
          {data.building_alerts.map((alert) => (
            <p className={s.error} key={alert.id}>
              <strong>{alert.name}</strong> is marked {alert.status}. Check
              campus updates before travelling.
            </p>
          ))}
          {room?.ticket.status.toUpperCase() === "CALLED" ? (
            <div className={`${s.notice} ${s.bar}`}>
              <p>
                <strong>Your room ticket has been called.</strong> Open it to
                review the check-in window.
              </p>
              <Link className={s.link} href="/student/services/queues">
                Review called ticket →
              </Link>
            </div>
          ) : null}
          <div className={s.split}>
            <div className={s.main}>
              <section className={s.next} aria-label="Next scheduled class">
                <p className={s.eyebrow}>Your next class</p>
                {next ? (
                  <>
                    <h2>{next.course_title || next.course_code}</h2>
                    <p className="mt-2">
                      {next.course_code} · {next.session_type || "Class"}
                    </p>
                    <p className={s.time}>{classTime(next)}</p>
                    <p>
                      {dayShort(next.day_of_week)} ·{" "}
                      {next.room_code ?? "Room to be announced"}
                      {next.building_code ? ` · ${next.building_code}` : ""}
                    </p>
                    {typeof next.minutes_until === "number" &&
                    next.minutes_until > 0 &&
                    next.minutes_until < 60 ? (
                      <p className="mt-2">
                        {next.minutes_until < 60
                          ? `Starts in ${Math.round(next.minutes_until)} min`
                          : "Check the scheduled day and time above."}
                      </p>
                    ) : null}
                    <div className={s.actions}>
                      {next.room_code ? (
                        <Link
                          className={s.link}
                          href={`/student/campus/map?route=${encodeURIComponent(next.room_code)}#route-preview`}
                        >
                          Preview route →
                        </Link>
                      ) : null}
                      <Link className={s.link} href="/student/timetable">
                        Open my timetable
                      </Link>
                    </div>
                  </>
                ) : (
                  <>
                    <h2>A little room in your day.</h2>
                    <p className="mt-4">
                      No upcoming class was returned. Check your timetable for
                      the full published schedule.
                    </p>
                    <div className={s.actions}>
                      <Link className={s.link} href="/student/timetable">
                        Open my timetable
                      </Link>
                      <Link className={s.link} href="/student/campus/rooms">
                        Find a study space →
                      </Link>
                    </div>
                  </>
                )}
              </section>
              <section className={s.panel}>
                <div className={s.bar}>
                  <div>
                    <p className={s.eyebrow}>The day ahead</p>
                    <h2>Today’s agenda</h2>
                  </div>
                  <span className={s.muted}>
                    {data.today.entries.length} sessions
                    {typeof data.today.remaining === "number"
                      ? ` · ${data.today.remaining} remaining`
                      : ""}
                  </span>
                </div>
                {data.today.entries.length ? (
                  <ol className={s.agenda}>
                    {[...data.today.entries]
                      .sort((a, b) =>
                        (a.starts_at || a.starts_at_iso).localeCompare(
                          b.starts_at || b.starts_at_iso,
                        ),
                      )
                      .map((entry) => (
                        <li key={entry.id}>
                          <time>
                            {clock(entry.starts_at || entry.starts_at_iso)}
                          </time>
                          <div className={s.details}>
                            <div className={s.bar}>
                              <h3>{entry.course_title || entry.course_code}</h3>
                              {entry.is_now ? (
                                <Badge tone="success">In progress</Badge>
                              ) : null}
                            </div>
                            <p>
                              {entry.course_code} ·{" "}
                              {entry.session_type || "Class"} · until{" "}
                              {clock(entry.ends_at || entry.ends_at_iso)}
                            </p>
                            <p>
                              {entry.room_code ?? "Room TBA"}
                              {entry.building_code
                                ? ` · ${entry.building_code}`
                                : ""}
                            </p>
                            {entry.room_code ? (
                              <Link
                                className="mt-2 inline-block text-xs font-semibold text-emerald-800 underline underline-offset-4"
                                href={`/student/campus/rooms/${encodeURIComponent(entry.room_code)}`}
                              >
                                View room details
                              </Link>
                            ) : null}
                          </div>
                        </li>
                      ))}
                  </ol>
                ) : (
                  <div className={s.empty}>
                    <h3>No classes scheduled today</h3>
                    <p>
                      Explore a study space or check what is happening around
                      campus.
                    </p>
                  </div>
                )}
              </section>
              <section className={s.panel}>
                <div className={s.bar}>
                  <h2>Campus bulletin</h2>
                  <Link className={s.link} href="/student/announcements">
                    All announcements →
                  </Link>
                </div>
                {data.announcements.length ? (
                  data.announcements.map((a) => (
                    <article className={s.bulletin} key={a.id}>
                      <div className={s.bar}>
                        <h3>{a.title}</h3>
                        {a.priority !== "normal" ? (
                          <Badge tone="warning">{a.priority}</Badge>
                        ) : null}
                      </div>
                      <p>{a.body}</p>
                    </article>
                  ))
                ) : (
                  <div className={s.empty}>
                    <h3>You’re up to date</h3>
                    <p>No announcements in your dashboard feed.</p>
                  </div>
                )}
              </section>
              <section className={s.panel}>
                <div className={s.bar}>
                  <h2>On the campus calendar</h2>
                  <Link className={s.link} href="/student/campus/events">
                    Explore events →
                  </Link>
                </div>
                {data.events.length ? (
                  data.events.map((e) => (
                    <article className={s.bulletin} key={e.id}>
                      <h3>{e.title}</h3>
                      <p>
                        {momentLabel(e.starts_at)} ·{" "}
                        {e.venue || "Venue to be announced"}
                      </p>
                    </article>
                  ))
                ) : (
                  <p className={`${s.muted} mt-4`}>
                    No upcoming events in this feed.
                  </p>
                )}
              </section>
            </div>
            <aside className={s.rail}>
              <section className={s.panel}>
                <Image
                  src="/images/campus-workspace.webp"
                  alt=""
                  width={550}
                  height={366}
                  sizes="(max-width:650px) 100vw, 290px"
                  className={s.dayArt}
                />
                <p className={s.eyebrow}>Your campus toolkit</p>
                <h2>Where to next?</h2>
                <div className={`${s.actions} mt-4`}>
                  {data.quick_actions.map((a) => {
                    const href = assistantWebHref(a.href);
                    return href ? (
                      <Link key={a.id} className={s.link} href={href}>
                        {a.label} →
                      </Link>
                    ) : null;
                  })}
                  <Link className={s.link} href="/student/assistant">
                    Ask the campus assistant →
                  </Link>
                </div>
                <p className={`${s.muted} mt-4`}>
                  {data.term?.name || "Term not provided"}
                  {data.campus_snapshot
                    ? ` · ${data.campus_snapshot.enrolled_courses} enrolled courses`
                    : ""}
                </p>
              </section>
              <section className={s.panel}>
                <p className={s.eyebrow}>Keep your place</p>
                <h2>Your service tickets</h2>
                <article className={s.ticketStub}>
                  <h3>Room queue</h3>
                  {room ? (
                    <>
                      <p className={`${s.ticketNumber} mt-3`}>
                        {room.ticket.ticket_number}
                      </p>
                      <p className={s.muted}>
                        {room.queue.room_code} · {room.queue.room_name}
                      </p>
                      <p className={`${s.muted} mt-2`}>
                        {statusLabel(room.ticket.status.toUpperCase())}
                        {typeof room.people_ahead === "number"
                          ? ` · ${room.people_ahead} ahead`
                          : ""}
                      </p>
                    </>
                  ) : (
                    <p className={`${s.muted} mt-3`}>No active room ticket.</p>
                  )}
                  <Link className={s.link} href="/student/services/queues">
                    {room ? "Open queue ticket" : "Browse queues"} →
                  </Link>
                </article>
                <article className={s.ticketStub}>
                  <h3>Office services</h3>
                  {office ? (
                    <>
                      <p className={`${s.ticketNumber} mt-3`}>
                        {office.ticket.ticket_number}
                      </p>
                      <p className={s.muted}>{office.office.name}</p>
                      <p className={`${s.muted} mt-2`}>
                        {office.status_label ||
                          statusLabel(office.ticket.status)}
                      </p>
                    </>
                  ) : (
                    <p className={`${s.muted} mt-3`}>
                      No active office ticket.
                    </p>
                  )}
                  <Link
                    className={s.link}
                    href={
                      office
                        ? `/student/services/offices/tickets/${office.ticket.id}`
                        : "/student/services/offices"
                    }
                  >
                    {office ? "Open office ticket" : "Find an office"} →
                  </Link>
                </article>
              </section>
              <section className={s.panel}>
                <div className={s.bar}>
                  <h2>Inbox</h2>
                  <Badge tone="neutral">
                    {data.unread_notifications} unread
                  </Badge>
                </div>
                {data.notifications.length ? (
                  data.notifications.slice(0, 3).map((n) => (
                    <article className={s.bulletin} key={n.id}>
                      <h3>{n.title}</h3>
                      <p>{n.body}</p>
                    </article>
                  ))
                ) : (
                  <p className={`${s.muted} mt-4`}>No recent notifications.</p>
                )}
                <Link className={`${s.link} mt-4`} href="/notifications">
                  Open notifications →
                </Link>
              </section>
              <section className={s.panel}>
                <h3>Room queue activity</h3>
                {queues.error ? (
                  <ReadError message={queues.error} retry={queues.reload} />
                ) : queues.loading ? (
                  <p className={`${s.muted} mt-4`} role="status">
                    Loading queue activity…
                  </p>
                ) : (
                  <>
                    {(queues.data?.queues ?? [])
                      .filter((q) => q.waiting > 0 || q.my_ticket_id)
                      .slice(0, 3)
                      .map((q) => (
                        <article className={s.bulletin} key={q.id}>
                          <h3>
                            {q.room_code} · {q.room_name}
                          </h3>
                          <p>{q.waiting} waiting · last loaded count</p>
                        </article>
                      ))}
                    {!(queues.data?.queues ?? []).some(
                      (q) => q.waiting > 0 || q.my_ticket_id,
                    ) ? (
                      <p className={`${s.muted} mt-4`}>
                        No waiting lines in the current queue feed.
                      </p>
                    ) : null}
                  </>
                )}
                <Link
                  className={`${s.link} mt-4`}
                  href="/student/services/queues"
                >
                  View room queues →
                </Link>
              </section>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
