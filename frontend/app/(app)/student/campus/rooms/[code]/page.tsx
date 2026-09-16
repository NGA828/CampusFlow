"use client";

import { use, useState } from "react";
import Link from "next/link";
import { WorkspaceIcon } from "@/components/layout/workspace-visual";
import { useAsync, dayName, formatClock, formatDate } from "@/lib/hooks";
import { campusApi, queueApi, studentApi } from "@/lib/api/endpoints";
import {
  Badge,
  Button,
  CardSkeleton,
  ErrorState,
  KeyValue,
  Progress,
} from "@/components/ui/kit";
import { PageHeader } from "@/components/layout/app-shell";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/client";
import s from "@/components/layout/student-discovery.module.css";

const clock = (time: string) => formatClock(`2000-01-01T${time}`);

export default function RoomDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const toast = useToast();
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [schedule, setSchedule] = useState<"today" | "week">("today");
  const room = useAsync(() => campusApi.room(code), [code]);
  const breadcrumb = [
    { label: "Rooms", href: "/student/campus/rooms" },
    { label: code },
  ];
  if (room.loading || !room.data || room.error)
    return (
      <div className={s.page}>
        <PageHeader title="Room" breadcrumb={breadcrumb} />
        {room.loading ? (
          <CardSkeleton rows={8} />
        ) : (
          <ErrorState
            message={room.error ?? "Room details are unavailable."}
            onRetry={room.reload}
          />
        )}
      </div>
    );
  const { room: details, availability: a, week } = room.data;
  const occupancy = a.occupancy;
  const kind = (details.room_type ?? details.type ?? "Room").replaceAll(
    "_",
    " ",
  );
  const joinQueue = async () => {
    if (joining) return;
    setJoining(true);
    setJoinError(null);
    try {
      const board = await studentApi.queueBoard();
      const queue = board.queues.find((q) => q.room_id === details.id);
      if (!queue)
        throw new Error("No admission queue is configured for this room.");
      await queueApi.join(queue.id, {});
      setJoined(true);
      toast.success(
        "You joined the queue",
        "Open your queue screen to follow your position.",
      );
    } catch (error) {
      const message =
        error instanceof ApiError
          ? (error.firstError ?? error.message)
          : error instanceof Error
            ? error.message
            : "Could not join the queue.";
      setJoinError(message);
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className={s.page}>
      <PageHeader title="Room details" breadcrumb={breadcrumb} />
      <section className={s.detailHero} aria-label="Room identity">
        <div className={s.roomSymbol}>
          <WorkspaceIcon
            name="room"
            size={65}
            strokeWidth={1}
            aria-hidden="true"
          />
        </div>
        <div>
          <p className={s.eyebrow}>
            {kind} / {details.code}
          </p>
          <h2>{details.name}</h2>
          <p className={s.muted}>
            {[
              details.building_name ?? details.building_code,
              details.floor_name,
            ]
              .filter(Boolean)
              .join(" · ") || "Location details not listed"}
          </p>
          {details.description ? (
            <p className={s.muted}>{details.description}</p>
          ) : null}
        </div>
        <div className={s.actions}>
          <Link
            className={s.link}
            href={`/student/campus/map?route=${encodeURIComponent(details.code)}`}
          >
            Plan route here <WorkspaceIcon name="arrow" size={17} />
          </Link>
        </div>
      </section>
      <div className={s.detailColumns}>
        <div className={s.stack}>
          <section className={s.availability} aria-label="Current availability">
            <div className={s.toolbar}>
              <p className={s.eyebrow}>Availability today</p>
              <span className={s.muted}>
                {formatDate(`${a.date}T12:00:00`, {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}
              </span>
            </div>
            <Badge
              tone={
                !a.is_open
                  ? "neutral"
                  : a.is_available_now
                    ? "success"
                    : "warning"
              }
            >
              {!a.is_open
                ? "Closed"
                : a.is_available_now
                  ? "Available now"
                  : "In use"}
            </Badge>
            <h2>{a.headline || "Check today’s schedule"}</h2>
            {a.current_session ? (
              <p className={s.muted}>
                {a.current_session.course_code} ·{" "}
                {a.current_session.course_title} · until{" "}
                {clock(a.current_session.ends_at)}
              </p>
            ) : (
              <p className={s.muted}>
                {a.reason ??
                  "Availability is calculated from campus schedules and admission data."}
              </p>
            )}
            <div className={s.availabilityStats}>
              <div>
                Scheduled sessions<strong>{a.session_count}</strong>
              </div>
              <div>
                Next available
                <strong>
                  {!a.is_open
                    ? "Not open"
                    : a.is_available_now
                      ? "Now"
                      : a.next_free_at
                        ? clock(a.next_free_at)
                        : "Not listed"}
                </strong>
              </div>
            </div>
          </section>
          <section className={s.panel} aria-label="Room schedule">
            <div className={s.toolbar}>
              <div>
                <h2>Make room in your day</h2>
                <p className={s.muted}>
                  Your guide to the room’s teaching schedule.
                </p>
              </div>
              <div
                className="flex gap-2"
                role="group"
                aria-label="Schedule view"
              >
                <button
                  className={s.chip}
                  aria-pressed={schedule === "today"}
                  onClick={() => setSchedule("today")}
                >
                  Today
                </button>
                <button
                  className={s.chip}
                  aria-pressed={schedule === "week"}
                  onClick={() => setSchedule("week")}
                >
                  This week
                </button>
              </div>
            </div>
            {schedule === "today" ? (
              <>
                <h3 className={s.eyebrow}>Free slots today</h3>
                {a.free_slots.length ? (
                  <div className={s.slotRow}>
                    {a.free_slots.map((slot, i) => (
                      <span className={s.slot} key={i}>
                        {clock(slot.starts_at)} – {clock(slot.ends_at)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className={s.muted}>No free slots are listed for today.</p>
                )}
                {!a.is_open && a.free_slots.length > 0 ? (
                  <p className={s.muted}>
                    Schedule gaps do not override the room’s closed status.
                  </p>
                ) : null}
                <ul className={s.agenda}>
                  {a.busy.map((slot, i) => (
                    <li key={i}>
                      <time>
                        {clock(slot.starts_at)}
                        <br />
                        {clock(slot.ends_at)}
                      </time>
                      <div>
                        <strong>
                          {slot.course_code ?? "Reserved session"}
                        </strong>
                        <p>{slot.course_title}</p>
                        <p className={s.muted}>{slot.session_type}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                {!a.busy.length ? (
                  <p className={`${s.muted} mt-5`}>
                    {a.session_count > 0
                      ? "Session details are not available."
                      : "No teaching sessions are scheduled today."}
                  </p>
                ) : null}
              </>
            ) : (
              <>
                <p className={`${s.muted} mb-4`}>
                  Recurring sessions from the master timetable. This is not a
                  booking form.
                </p>
                {week.length ? (
                  [...new Set(week.map((e) => e.day_of_week))]
                    .sort((x, y) => x - y)
                    .map((day) => (
                      <div className={s.weekDay} key={day}>
                        <h3>{dayName(day)}</h3>
                        {week
                          .filter((e) => e.day_of_week === day)
                          .sort((x, y) =>
                            x.starts_at.localeCompare(y.starts_at),
                          )
                          .map((entry, i) => (
                            <p key={entry.id ?? i}>
                              <span className={s.muted}>
                                {clock(entry.starts_at)} –{" "}
                                {clock(entry.ends_at)}
                              </span>
                              <br />
                              {entry.course_code ?? "Reserved"} ·{" "}
                              {entry.course_title ?? entry.session_type}
                            </p>
                          ))}
                      </div>
                    ))
                ) : (
                  <p className={s.muted}>
                    No recurring sessions are scheduled in this room this term.
                  </p>
                )}
              </>
            )}
          </section>
        </div>
        <aside className={s.stack} aria-label="Room information and admission">
          <section className={s.panel}>
            <h2>Before you arrive</h2>
            <dl className="divide-y divide-ink-50">
              <KeyValue
                label="Capacity"
                value={
                  details.capacity == null
                    ? "Not listed"
                    : `${details.capacity} seats`
                }
              />
              <KeyValue label="Room type" value={kind} />
              <KeyValue
                label="Admission"
                value={
                  details.requires_admission
                    ? "Queue required"
                    : "No admission queue"
                }
              />
              <KeyValue
                label="Floor"
                value={details.floor_name ?? "Not listed"}
              />
            </dl>
            {(details.amenities ?? details.features ?? []).length ? (
              <>
                <p className={`${s.eyebrow} mt-5`}>Facilities</p>
                <div className={s.slotRow}>
                  {(details.amenities ?? details.features ?? []).map((f) => (
                    <Badge key={f} tone="neutral">
                      {f.replaceAll("_", " ")}
                    </Badge>
                  ))}
                </div>
              </>
            ) : null}
            {details.accessibility?.length ? (
              <>
                <p className={`${s.eyebrow} mt-5`}>Accessibility</p>
                <div className={s.slotRow}>
                  {details.accessibility.map((f) => (
                    <Badge key={f} tone="success">
                      {f.replaceAll("_", " ")}
                    </Badge>
                  ))}
                </div>
              </>
            ) : (
              <p className={`${s.muted} mt-4`}>
                Accessibility information has not been listed for this room.
              </p>
            )}
          </section>
          <section className={s.panel}>
            <h2>Admission & occupancy</h2>
            {occupancy ? (
              <>
                <p className="mt-4 text-3xl font-semibold">
                  {occupancy.inside}
                  <span className="text-sm font-normal text-ink-500">
                    {" "}
                    / {occupancy.capacity} admitted
                  </span>
                </p>
                <Progress
                  value={
                    occupancy.capacity > 0
                      ? (occupancy.inside / occupancy.capacity) * 100
                      : 0
                  }
                />
                <p className={s.muted}>
                  Checked-in people against the admission limit, not a seat
                  reservation.
                </p>
              </>
            ) : (
              <p className={s.muted}>
                Live occupancy is not tracked for this room.
              </p>
            )}
            {a.queue ? (
              <p className={`${s.muted} mt-4`}>
                {a.queue.waiting} waiting · queue{" "}
                {a.queue.is_active ? "open" : "closed"}
                {a.queue.requires_proximity
                  ? " · proximity check required"
                  : ""}
              </p>
            ) : null}
            {joinError ? (
              <p role="alert" className={`${s.inlineError} mt-4`}>
                {joinError}
              </p>
            ) : null}
            {joined ? (
              <p role="status" className={`${s.muted} mt-4`}>
                You joined the queue. Follow your ticket below.
              </p>
            ) : details.requires_admission ? (
              <Button
                className="mt-4"
                loading={joining}
                onClick={() => void joinQueue()}
              >
                Join queue
              </Button>
            ) : null}
            {details.requires_admission || a.queue ? (
              <Link href="/student/services/queues" className={s.link}>
                Open queue screen <WorkspaceIcon name="arrow" size={15} />
              </Link>
            ) : null}
          </section>
          <section className={s.panel}>
            <WorkspaceIcon name="pin" size={22} aria-hidden="true" />
            <h2 className="mt-3">Find your way</h2>
            <p className={s.muted}>
              {details.building_name ?? "Campus map"}
              {details.floor_name ? ` · ${details.floor_name}` : ""}
            </p>
            <Link
              href={`/student/campus/map?route=${encodeURIComponent(details.code)}`}
              className={s.link}
            >
              Open in the campus map <WorkspaceIcon name="arrow" size={15} />
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
