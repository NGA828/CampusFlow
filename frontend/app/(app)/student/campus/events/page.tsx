"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { WorkspaceIcon } from "@/components/layout/workspace-visual";
import { useAsync, useNow, formatClock, formatDate } from "@/lib/hooks";
import { engagementApi } from "@/lib/api/endpoints";
import type { CampusEvent } from "@/lib/api/types";
import { ApiError } from "@/lib/api/client";
import {
  Badge,
  Button,
  CardSkeleton,
  EmptyState,
  ErrorState,
  Input,
} from "@/components/ui/kit";
import { PageHeader } from "@/components/layout/app-shell";
import s from "@/components/layout/student-discovery.module.css";

export default function EventsPage() {
  const now = useNow();
  const [category, setCategory] = useState("all");
  const [view, setView] = useState("upcoming");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const mutationLock = useRef(false);
  const [feedback, setFeedback] = useState<{
    id: string;
    message: string;
    error: boolean;
  } | null>(null);
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  const events = useAsync(
    () => engagementApi.events({ per_page: 40, page }),
    [page],
  );
  const items = events.data?.items ?? [];
  const isRegistered = (e: CampusEvent) =>
    confirmed[e.id] ??
    e.is_registered ??
    e.registered ??
    events.data?.registered_event_ids.includes(e.id) ??
    false;
  const isPast = (e: CampusEvent) =>
    new Date(e.ends_at ?? e.starts_at).getTime() <= now.getTime();
  const visible = items
    .filter(
      (e) =>
        (category === "all" || e.category === category) &&
        `${e.title} ${e.description ?? ""} ${e.venue ?? ""}`
          .toLowerCase()
          .includes(search.trim().toLowerCase()) &&
        (view === "registered"
          ? isRegistered(e)
          : view === "past"
            ? isPast(e)
            : !isPast(e)),
    )
    .sort(
      (a, b) =>
        (view === "past" ? -1 : 1) *
        (new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()),
    );
  const featured = view === "upcoming" ? visible[0] : undefined;
  const remaining = featured ? visible.slice(1) : visible;
  const meta = events.data?.meta;
  const categories = [...new Set(items.map((e) => e.category))].sort();

  async function toggle(e: CampusEvent) {
    if (mutationLock.current) return;
    mutationLock.current = true;
    setBusy(e.id);
    setFeedback(null);
    const registered = isRegistered(e);
    try {
      if (registered) await engagementApi.unregister(e.id);
      else await engagementApi.register(e.id);
      setConfirmed((old) => ({ ...old, [e.id]: !registered }));
      setFeedback({
        id: e.id,
        message: registered
          ? "Registration cancelled."
          : "You are registered for this event.",
        error: false,
      });
    } catch (error) {
      setFeedback({
        id: e.id,
        message:
          error instanceof ApiError
            ? (error.firstError ?? error.message)
            : "Could not update registration. Please try again.",
        error: true,
      });
    } finally {
      mutationLock.current = false;
      setBusy(null);
    }
  }

  const content = (event: CampusEvent, feature = false) => {
    const registered = isRegistered(event);
    const full =
      typeof event.capacity === "number" &&
      typeof event.registrations === "number" &&
      event.registrations >= event.capacity &&
      !registered;
    const started = new Date(event.starts_at).getTime() <= now.getTime();
    const destination = event.room_code ?? event.room_id;
    return (
      <>
        <div className="flex flex-wrap gap-2">
          <Badge tone="neutral">{event.category}</Badge>
          {registered ? <Badge tone="success">Registered</Badge> : null}
        </div>
        {!feature ? (
          <div className={s.dateRow}>
            <div className={s.dateStamp} aria-hidden="true">
              {new Date(event.starts_at).toLocaleDateString([], {
                month: "short",
              })}
              <strong>{new Date(event.starts_at).getDate()}</strong>
            </div>
            <h3>{event.title}</h3>
          </div>
        ) : (
          <h3>{event.title}</h3>
        )}
        <div className={s.eventMeta}>
          <p>
            <WorkspaceIcon name="calendar" size={15} />
            <span>
              {formatDate(event.starts_at, {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
          </p>
          <p>
            <WorkspaceIcon name="clock" size={15} />
            <span>
              {formatClock(event.starts_at)}
              {event.ends_at ? ` – ${formatClock(event.ends_at)}` : ""}
            </span>
          </p>
          <p>
            <WorkspaceIcon name="pin" size={15} />
            <span>
              {event.venue ?? event.building_name ?? "Venue to be announced"}
            </span>
          </p>
        </div>
        {event.description ? (
          <details className={s.disclosure}>
            <summary>About this event</summary>
            <p>{event.description}</p>
          </details>
        ) : null}
        {event.organiser_name ? (
          <p className={s.muted}>Hosted by {event.organiser_name}</p>
        ) : null}
        {typeof event.capacity === "number" ? (
          <p className={s.muted}>
            {typeof event.registrations === "number"
              ? `At last refresh: ${event.registrations} registered · `
              : ""}
            {event.capacity} places in total
          </p>
        ) : null}
        <div className={s.actions}>
          {isPast(event) ? (
            <Badge tone="neutral">Finished</Badge>
          ) : event.registration_required === false ? (
            <Badge tone="neutral">No registration needed</Badge>
          ) : (
            <Button
              size="sm"
              variant={registered ? "secondary" : "primary"}
              loading={busy === event.id}
              disabled={busy !== null || full || (started && !registered)}
              onClick={() => void toggle(event)}
            >
              {registered
                ? "Cancel registration"
                : full
                  ? "Event full"
                  : started
                    ? "Event started"
                    : "Register"}
            </Button>
          )}
          {destination ? (
            <Link
              href={`/student/campus/map?route=${encodeURIComponent(destination)}`}
              className={s.link}
            >
              Directions <WorkspaceIcon name="arrow" size={15} />
            </Link>
          ) : event.building_code ? (
            <Link href="/student/campus/map" className={s.link}>
              Campus map <WorkspaceIcon name="arrow" size={15} />
            </Link>
          ) : null}
        </div>
      </>
    );
  };

  return (
    <div className={s.page}>
      <PageHeader
        title="Campus events"
        description="Discover what’s happening beyond the classroom."
      />
      <div className={s.eventHeading}>
        <div>
          <p className={s.eyebrow}>Come curious. Leave connected.</p>
          <h2>There’s more to campus.</h2>
          <p className={s.muted}>
            Make time for a new idea, a shared interest or a familiar face.
          </p>
        </div>
        <WorkspaceIcon
          name="queue"
          size={44}
          strokeWidth={1.1}
          aria-hidden="true"
        />
      </div>
      <div className={s.toolbar}>
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Event view"
        >
          {[
            ["upcoming", "Upcoming"],
            ["registered", "My registrations"],
            ["past", "Past events"],
          ].map(([v, label]) => (
            <button
              key={v}
              className={s.chip}
              aria-pressed={view === v}
              onClick={() => setView(v)}
            >
              {label}
            </button>
          ))}
        </div>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy !== null || events.loading}
          onClick={() => {
            setConfirmed({});
            setFeedback(null);
            events.reload();
          }}
        >
          Refresh events
        </Button>
      </div>
      <div className={s.toolbar}>
        <div className={s.search}>
          <Input
            aria-label="Search events on this page"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events on this page"
          />
        </div>
      </div>
      <div className={s.chips} role="group" aria-label="Event categories">
        {["all", ...categories].map((c) => (
          <button
            key={c}
            className={s.chip}
            aria-pressed={category === c}
            onClick={() => setCategory(c)}
          >
            {c === "all" ? "All categories" : c}
          </button>
        ))}
      </div>
      {feedback ? (
        <p
          role={feedback.error ? "alert" : "status"}
          className={`${feedback.error ? s.inlineError : s.slot} mb-5`}
        >
          {feedback.message}
        </p>
      ) : null}
      <section aria-label="Event results" aria-busy={events.loading}>
        {events.loading ? (
          <div className={s.grid}>
            <CardSkeleton rows={7} />
            <CardSkeleton rows={7} />
          </div>
        ) : events.error ? (
          <ErrorState message={events.error} onRetry={events.reload} />
        ) : (
          <>
            <p className={`${s.muted} mb-5`} role="status">
              {visible.length} {view === "registered" ? "registered" : view}{" "}
              events shown · filters apply to this page
            </p>
            {!visible.length ? (
              <EmptyState
                title={
                  view === "registered"
                    ? "No registrations on this page"
                    : "No events match this view"
                }
                description="Try another category, clear your search or browse another page."
                action={
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setCategory("all");
                      setSearch("");
                    }}
                  >
                    Clear filters
                  </Button>
                }
              />
            ) : null}
            {featured ? (
              <article className={s.featureEvent}>
                <div className={s.eventPoster} aria-hidden="true">
                  <p className={s.eyebrow}>Next on this page</p>
                  <div className={s.posterDate}>
                    {new Date(featured.starts_at).getDate()}
                    <small>
                      {new Date(featured.starts_at).toLocaleDateString([], {
                        month: "short",
                      })}
                    </small>
                  </div>
                  <WorkspaceIcon name="queue" size={34} strokeWidth={1.2} />
                </div>
                <div className={s.featureBody}>{content(featured, true)}</div>
              </article>
            ) : null}
            {remaining.length ? (
              <>
                <h2 className="mb-5">
                  {featured
                    ? "Keep exploring"
                    : view === "registered"
                      ? "Your registered events"
                      : "Around campus"}
                </h2>
                <div className={s.grid}>
                  {remaining.map((event) => (
                    <article key={event.id} className={s.eventCard}>
                      {content(event)}
                    </article>
                  ))}
                </div>
              </>
            ) : null}
            {meta && meta.total_pages > 1 ? (
              <nav className={s.pagination} aria-label="Event pages">
                <span>
                  Page {meta.page} of {meta.total_pages} · {meta.total}{" "}
                  published events
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page <= 1 || busy !== null}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous page
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page >= meta.total_pages || busy !== null}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next page
                  </Button>
                </div>
              </nav>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
