"use client";

import Link from "next/link";
import { studentApi } from "@/lib/api";
import type {
  Announcement,
  ClassSession,
  NextClass,
  QueueTicketSummary,
  Room,
} from "@/lib/api/types";
import { useApiResource } from "@/hooks/use-api";
import { useSession } from "@/hooks/use-session";
import { formatClock, formatDayHeading } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { ErrorState, LoadingState } from "@/components/ui/states";
import {
  IconArrowRight,
  IconBuilding,
  IconChevronRight,
  IconClock,
  IconPin,
  IconQueue,
  IconUsers,
} from "@/components/ui/icons";

export function StudentDashboard() {
  const { user } = useSession();
  const { data, error, loading, refetch } = useApiResource(() =>
    studentApi.dashboard(),
  );

  if (loading) return <LoadingState label="Loading your day…" />;
  if (error) {
    return <ErrorState message={error.message} onRetry={refetch} />;
  }
  if (!data) return null;

  return (
    <div className="space-y-6 animate-fade-up">
      <header className="flex flex-col gap-1">
        <p className="text-sm font-medium text-ink-500">
          {formatDayHeading(new Date())}
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-ink-900">
          {data.greeting},{" "}
          <span className="text-brand-700">{user?.name.split(" ")[0]}</span>
        </h1>
      </header>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <NextClassCard next={data.next_class} />
          <TodaySchedule classes={data.today_classes} count={data.today_count} />
        </div>

        <div className="space-y-5">
          <QueueTicketCard ticket={data.queue_ticket} />
          <AnnouncementsCard announcements={data.announcements} />
          <NearbyRooms rooms={data.nearby_rooms} />
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */

function NextClassCard({ next }: { next: NextClass | null }) {
  return (
    <section className="relative overflow-hidden rounded-2xl bg-ink-900 p-6 text-white shadow-lifted">
      <div
        className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-brand-500/20 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-24 right-24 h-48 w-48 rounded-full bg-accent-500/20 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-300">
            Next class
          </p>
          {next ? (
            <>
              <h2 className="mt-2 text-2xl font-bold">{next.course.name}</h2>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-200">
                <span className="inline-flex items-center gap-1.5">
                  <IconClock className="h-4 w-4" />
                  {formatClock(next.starts_at)} – {formatClock(next.ends_at)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <IconBuilding className="h-4 w-4" />
                  {next.room.code}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <IconPin className="h-4 w-4" />
                  {next.room.building.name} · Floor {next.room.floor}
                </span>
              </div>
            </>
          ) : (
            <>
              <h2 className="mt-2 text-2xl font-bold">No more classes today</h2>
              <p className="mt-2 text-sm text-ink-300">
                Your schedule is clear. Enjoy the rest of your day.
              </p>
            </>
          )}
        </div>

        {next ? (
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <Badge tone="warning" className="bg-white/10 text-amber-200 ring-white/20">
              {next.minutes_until_start <= 10
                ? "Starting soon"
                : `In ${next.minutes_until_start} min`}
            </Badge>
            <span
              aria-disabled
              title="Navigation arrives in an upcoming phase"
              className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-ink-300"
            >
              Navigate
              <IconArrowRight className="h-4 w-4" />
              <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                soon
              </span>
            </span>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- */

function TodaySchedule({
  classes,
  count,
}: {
  classes: ClassSession[];
  count: number;
}) {
  return (
    <Card>
      <CardHeader
        title="Today's schedule"
        subtitle={`${count} session${count === 1 ? "" : "s"} today`}
        action={
          <Link
            href="/student/timetable"
            className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
          >
            Full timetable
            <IconChevronRight className="h-3.5 w-3.5" />
          </Link>
        }
      />
      <ul className="divide-y divide-ink-100">
        {classes.map((c) => {
          return (
            <li
              key={c.id}
              className="flex items-center gap-4 py-3"
            >
              <div className="w-24 shrink-0 text-sm font-semibold tnum text-ink-800">
                {formatClock(c.starts_at)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink-900">
                  {c.course.name}
                </p>
                <p className="truncate text-xs text-ink-500">
                  {c.course.code} · {c.instructor}
                </p>
              </div>
              <Badge tone={c.type === "lab" ? "info" : c.type === "tutorial" ? "accent" : "brand"}>
                {c.type}
              </Badge>
              <div className="hidden w-24 shrink-0 text-right text-xs text-ink-500 sm:block">
                {c.room.code}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/* ---------------------------------------------------------------- */

function QueueTicketCard({ ticket }: { ticket: QueueTicketSummary | null }) {
  return (
    <Card>
      <CardHeader
        title="Your queue"
        subtitle="Active ticket"
        action={
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <IconQueue className="h-4 w-4" />
          </span>
        }
      />
      {ticket ? (
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold text-ink-900">{ticket.office.name}</p>
              <p className="text-xs text-ink-500">{ticket.office.building}</p>
            </div>
            <span className="rounded-lg bg-ink-900 px-2.5 py-1 font-mono text-sm font-bold text-white tnum">
              {ticket.ticket_no}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 rounded-xl bg-ink-50 p-3 text-center">
            <div>
              <p className="text-lg font-bold text-ink-900 tnum">#{ticket.position}</p>
              <p className="text-[11px] text-ink-500">Position</p>
            </div>
            <div className="border-x border-ink-200">
              <p className="text-lg font-bold text-ink-900 tnum">{ticket.people_ahead}</p>
              <p className="text-[11px] text-ink-500">Ahead</p>
            </div>
            <div>
              <p className="text-lg font-bold text-ink-900 tnum">{ticket.estimated_wait_minutes}m</p>
              <p className="text-[11px] text-ink-500">Wait</p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Badge tone="warning" dot>
              {ticket.status === "approaching" ? "Approaching — head over" : ticket.status}
            </Badge>
            <span className="text-xs text-ink-500 tnum">{ticket.expected_window}</span>
          </div>
        </div>
      ) : (
        <p className="py-6 text-center text-sm text-ink-500">
          You&apos;re not in any queue right now.
        </p>
      )}
    </Card>
  );
}

/* ---------------------------------------------------------------- */

function AnnouncementsCard({ announcements }: { announcements: Announcement[] }) {
  return (
    <Card>
      <CardHeader title="Announcements" />
      <ul className="space-y-3">
        {announcements.slice(0, 2).map((a) => (
          <li key={a.id} className="rounded-lg border border-ink-100 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-ink-900">{a.title}</p>
              <Badge tone="neutral" className="shrink-0">
                {a.category}
              </Badge>
            </div>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-ink-600">{a.body}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ---------------------------------------------------------------- */

function NearbyRooms({ rooms }: { rooms: Room[] }) {
  return (
    <Card>
      <CardHeader title="Nearby rooms" subtitle="Currently available" />
      <ul className="space-y-2">
        {rooms.map((r) => (
          <li
            key={r.id}
            className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-ink-50"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
              <IconUsers className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink-900">{r.code}</p>
              <p className="truncate text-xs text-ink-500">
                {r.building.name} · {r.capacity} seats
              </p>
            </div>
            <Badge tone="success" dot>
              Free
            </Badge>
          </li>
        ))}
      </ul>
    </Card>
  );
}
