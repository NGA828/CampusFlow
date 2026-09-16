"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import { useAsync, useMediaQuery, useNow, formatDate } from "@/lib/hooks";
import { studentApi } from "@/lib/api/endpoints";
import type { TimetableEntry } from "@/lib/api/types";
import {
  Badge,
  Button,
  CardSkeleton,
  EmptyState,
  ErrorState,
} from "@/components/ui/kit";
import { PageHeader } from "@/components/layout/app-shell";
import { WorkspaceIcon } from "@/components/layout/workspace-visual";
import s from "@/components/layout/student-services.module.css";

function localDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function dayOffset(date: string, amount: number) {
  const next = new Date(`${date}T12:00:00`);
  next.setDate(next.getDate() + amount);
  return localDate(next);
}
const clock = (time: string) =>
  /^\d{2}:\d{2}/.test(time) ? time.slice(0, 5) : "—";

export default function TimetablePage() {
  const now = useNow(60_000);
  const today = localDate(now);
  const [weekOffset, setWeekOffset] = useState(0);
  const [chosenView, setChosenView] = useState<"grid" | "list" | null>(null);
  const wide = useMediaQuery("(min-width: 768px)");
  const view = chosenView ?? (wide ? "grid" : "list");
  const weekStart = dayOffset(today, -(now.getDay() || 7) + 1 + weekOffset * 7);
  const timetable = useAsync(
    () => studentApi.timetable(weekStart),
    [weekStart],
  );
  const data = !timetable.loading && !timetable.error ? timetable.data : null;
  const entries = [...(data?.entries ?? [])].sort(
    (a, b) =>
      a.date.localeCompare(b.date) || a.starts_at.localeCompare(b.starts_at),
  );
  const start = data?.week_start ?? weekStart;
  const dates = Array.from({ length: 7 }, (_, i) => dayOffset(start, i));
  const next = entries.find(
    (e) => new Date(e.ends_at_iso).getTime() > now.getTime(),
  );
  const detail = (entry: TimetableEntry) => (
    <>
      <p>{entry.course_title}</p>
      <p className={s.muted}>{entry.room_code ?? "Room to be announced"}</p>
      <details className={s.disclosure}>
        <summary>
          Session details
          <span className="sr-only">
            {" "}
            for {entry.course_code} on {entry.date}
          </span>
        </summary>
        <p>
          {entry.session_type} · {entry.lecturer ?? "Lecturer to be announced"}
          {entry.building_name ? `\n${entry.building_name}` : ""}
          {entry.note ? `\n${entry.note}` : ""}
        </p>
      </details>
      {entry.room_code ? (
        <div className={s.actions}>
          <Link
            className={s.link}
            href={`/student/campus/rooms/${encodeURIComponent(entry.room_code)}`}
          >
            Room details
          </Link>
          <Link
            className={s.link}
            href={`/student/campus/map?route=${encodeURIComponent(entry.room_code)}`}
          >
            Directions <WorkspaceIcon name="arrow" size={14} />
          </Link>
        </div>
      ) : null}
    </>
  );

  return (
    <div className={s.page}>
      <PageHeader
        title="Timetable"
        description="Your teaching week, published by your faculty."
      />
      <section className={s.weekHero} aria-label="Week overview">
        <div>
          <p className={s.eyebrow}>Plan a little. Know what’s next.</p>
          <h2>
            {new Intl.DateTimeFormat([], {
              day: "numeric",
              month: "long",
            }).formatRange(
              new Date(`${start}T12:00:00`),
              new Date(`${dayOffset(start, 6)}T12:00:00`),
            )}
          </h2>
          <p className={s.muted}>
            {data?.term ?? "Your enrolled courses"} · Read-only teaching
            schedule
          </p>
        </div>
        <dl className={s.weekStats}>
          <div>
            <dt>Sessions</dt>
            <dd>{data ? entries.length : "—"}</dd>
          </div>
          <div>
            <dt>Courses</dt>
            <dd>
              {data ? new Set(entries.map((e) => e.course_code)).size : "—"}
            </dd>
          </div>
        </dl>
      </section>
      <div className={s.toolbar}>
        <div className={s.controls} role="group" aria-label="Select week">
          <Button
            size="sm"
            variant="secondary"
            aria-label="Previous week"
            onClick={() => setWeekOffset((v) => v - 1)}
          >
            ←
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={weekOffset === 0}
            onClick={() => setWeekOffset(0)}
          >
            This week
          </Button>
          <Button
            size="sm"
            variant="secondary"
            aria-label="Next week"
            onClick={() => setWeekOffset((v) => v + 1)}
          >
            →
          </Button>
        </div>
        <div className={s.controls} role="group" aria-label="Schedule layout">
          <button
            className={s.chip}
            aria-pressed={view === "grid"}
            onClick={() => setChosenView("grid")}
          >
            Week grid
          </button>
          <button
            className={s.chip}
            aria-pressed={view === "list"}
            onClick={() => setChosenView("list")}
          >
            Day list
          </button>
          <Button
            variant="ghost"
            size="sm"
            disabled={timetable.loading}
            onClick={timetable.reload}
          >
            Refresh timetable
          </Button>
        </div>
      </div>
      <section aria-label="Published timetable" aria-busy={timetable.loading}>
        {timetable.loading ? (
          <CardSkeleton rows={8} />
        ) : timetable.error ? (
          <ErrorState message={timetable.error} onRetry={timetable.reload} />
        ) : !data ? (
          <ErrorState
            message="The timetable is unavailable."
            onRetry={timetable.reload}
          />
        ) : !entries.length ? (
          <EmptyState
            title="No sessions this week"
            description="No teaching is listed for your enrolled courses in this week."
            action={
              <Link className={s.link} href="/student/campus/events">
                Explore campus events <WorkspaceIcon name="arrow" size={16} />
              </Link>
            }
          />
        ) : (
          <>
            <div className={s.weekIntro}>
              <section className={s.nextClass}>
                <WorkspaceIcon name="calendar" size={27} />
                <div>
                  <p className={s.eyebrow}>
                    {next
                      ? new Date(next.starts_at_iso).getTime() <= now.getTime()
                        ? "In progress"
                        : "Next in this week"
                      : "Week at a glance"}
                  </p>
                  <h3>
                    {next
                      ? `${next.course_code} · ${next.course_title}`
                      : "All listed sessions have ended"}
                  </h3>
                  <p className={s.muted}>
                    {next
                      ? `${formatDate(`${next.date}T12:00:00`)} · ${clock(next.starts_at)} – ${clock(next.ends_at)} · ${next.room_code ?? "Room to be announced"}`
                      : "Browse the next week to see what your faculty has scheduled."}
                  </p>
                </div>
              </section>
              <section className={s.panel}>
                <p className={s.eyebrow}>Before your next class</p>
                <p className={`${s.muted} mt-3`}>
                  Times are shown as published by campus. Check the room details
                  before you go. Refresh to see newly published changes.
                </p>
              </section>
            </div>
            {view === "grid" ? (
              <div
                className={s.calendar}
                tabIndex={0}
                role="region"
                aria-label="Weekly timetable, scroll horizontally for more days"
              >
                <div
                  className={s.board}
                  style={{ "--days": dates.length } as CSSProperties}
                >
                  {dates.map((date) => (
                    <section
                      key={date}
                      className={s.dayColumn}
                      aria-label={formatDate(`${date}T12:00:00`, {
                        weekday: "long",
                      })}
                    >
                      <header
                        className={s.dayHeading}
                        data-today={date === today}
                      >
                        <span>
                          {new Date(`${date}T12:00:00`).toLocaleDateString([], {
                            weekday: "short",
                          })}
                          {date === today ? (
                            <span className="block text-[10px]">Today</span>
                          ) : null}
                        </span>
                        <strong>{Number(date.slice(8))}</strong>
                      </header>
                      <div className={s.daySessions}>
                        {entries.filter((e) => e.date === date).length ? (
                          entries
                            .filter((e) => e.date === date)
                            .map((entry) => (
                              <article
                                className={s.session}
                                data-tone={entry.session_type}
                                key={entry.id}
                              >
                                <time>
                                  {clock(entry.starts_at)} –{" "}
                                  {clock(entry.ends_at)}
                                </time>
                                <h3>{entry.course_code}</h3>
                                {detail(entry)}
                              </article>
                            ))
                        ) : (
                          <p className={`${s.muted} p-2`}>No sessions</p>
                        )}
                      </div>
                    </section>
                  ))}
                </div>
              </div>
            ) : (
              <div className={s.dayList}>
                {dates.map((date) => (
                  <section key={date}>
                    <header>
                      <h2>
                        {new Date(`${date}T12:00:00`).toLocaleDateString([], {
                          weekday: "long",
                        })}
                      </h2>
                      <p className={s.muted}>
                        {formatDate(`${date}T12:00:00`)}
                      </p>
                      {date === today ? (
                        <Badge tone="brand">Today</Badge>
                      ) : null}
                    </header>
                    <div className={s.listSessions}>
                      {entries.filter((e) => e.date === date).length ? (
                        entries
                          .filter((e) => e.date === date)
                          .map((entry) => (
                            <article className={s.listSession} key={entry.id}>
                              <time>
                                {clock(entry.starts_at)}
                                <span className={`block ${s.muted}`}>
                                  {clock(entry.ends_at)}
                                </span>
                              </time>
                              <div>
                                <h3>{entry.course_code}</h3>
                                {detail(entry)}
                              </div>
                            </article>
                          ))
                      ) : (
                        <p className={s.muted}>No sessions scheduled.</p>
                      )}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
