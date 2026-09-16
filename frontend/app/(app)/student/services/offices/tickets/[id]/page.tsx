"use client";

import { use, useRef, useState } from "react";
import Link from "next/link";
import {
  useAsync,
  formatClock,
  formatDate,
  formatDuration,
  STATUS_TONES,
  statusLabel,
} from "@/lib/hooks";
import { officeApi } from "@/lib/api/endpoints";
import { ApiError } from "@/lib/api/client";
import { Badge, Button, CardSkeleton, ErrorState } from "@/components/ui/kit";
import { PageHeader } from "@/components/layout/app-shell";
import { WorkspaceIcon } from "@/components/layout/workspace-visual";
import type { OfficeTicketView } from "@/lib/api/types";
import s from "@/components/layout/student-services.module.css";

const EVENT_LABELS: Record<string, string> = {
  created: "Ticket requested",
  requested: "Ticket requested",
  assigned: "Queued in line",
  approaching: "You signalled you are on the way",
  called: "Called to the desk",
  check_in_window: "Check-in window opened",
  checked_in: "Checked in at the office",
  in_service: "Service started",
  completed: "Service completed",
  cancelled: "Ticket cancelled",
  no_show: "Marked as no-show",
  expired: "Check-in window expired",
};
const GUIDANCE: Record<string, [string, string]> = {
  waiting: [
    "Your place is in the line.",
    "Keep your ticket number handy. The estimate can change as the office serves other students.",
  ],
  approaching: [
    "The office knows you’re on your way.",
    "Travel to the office and follow the arrival instructions in your ticket.",
  ],
  called: [
    "The office has called your number.",
    "Go to the desk and check the arrival requirements. If a deadline is listed, arrive before it.",
  ],
  in_service: [
    "Your visit is in progress.",
    "The office team will update your ticket when service is complete.",
  ],
  completed: [
    "Your visit is complete.",
    "Keep this page as a record of your office visit.",
  ],
  cancelled: [
    "Your ticket was cancelled.",
    "This ticket no longer holds a place in the service line.",
  ],
  no_show: [
    "Your visit was missed.",
    "Contact the office or request a new ticket if you still need help.",
  ],
  expired: [
    "This ticket has expired.",
    "Review office hours before requesting another visit.",
  ],
};

export default function OfficeTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const ticket = useAsync(() => officeApi.ticket(id), [id]);
  const history = useAsync(() => officeApi.history(id), [id]);
  const [confirmed, setConfirmed] = useState<OfficeTicketView | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [feedback, setFeedback] = useState<{
    error: boolean;
    message: string;
  } | null>(null);
  const lock = useRef(false);
  const current =
    confirmed && String(confirmed.ticket.id) === id ? confirmed : ticket.data;
  async function act(kind: "cancel" | "check-in" | "approaching") {
    if (lock.current) return;
    lock.current = true;
    setBusy(kind);
    setFeedback(null);
    try {
      const updated =
        kind === "cancel"
          ? await officeApi.cancel(id)
          : kind === "check-in"
            ? await officeApi.checkIn(id, {})
            : await officeApi.approaching(id);
      if (
        !updated?.ticket ||
        String(updated.ticket.id) !== id ||
        !updated.office ||
        !updated.counts ||
        typeof updated.people_ahead !== "number" ||
        typeof updated.can_cancel !== "boolean"
      )
        throw new Error(
          "The updated ticket could not be read. Refresh your ticket before trying another action.",
        );
      setConfirmed(updated);
      setConfirmCancel(false);
      setFeedback({
        error: false,
        message:
          kind === "cancel"
            ? "Ticket cancelled."
            : kind === "check-in"
              ? "The office confirmed your check-in."
              : "The office knows you are on your way.",
      });
      history.reload();
    } catch (error) {
      setFeedback({
        error: true,
        message:
          error instanceof ApiError
            ? (error.firstError ?? error.message)
            : error instanceof Error
              ? error.message
              : "The action could not be confirmed.",
      });
    } finally {
      lock.current = false;
      setBusy(null);
    }
  }
  const refresh = () => {
    setConfirmed(null);
    setFeedback(null);
    setConfirmCancel(false);
    ticket.reload();
    history.reload();
  };
  if (ticket.loading || ticket.error || !current)
    return (
      <div className={s.page}>
        <PageHeader
          title="Office ticket"
          breadcrumb={[
            { label: "Offices", href: "/student/services/offices" },
            { label: "Ticket" },
          ]}
        />
        {ticket.loading ? (
          <CardSkeleton rows={7} />
        ) : (
          <ErrorState
            message={ticket.error ?? "Ticket details are unavailable."}
            onRetry={refresh}
          />
        )}
      </div>
    );
  const status = current.ticket.status.toLowerCase();
  const terminal = ["completed", "cancelled", "no_show", "expired"].includes(
    status,
  );
  const guidance = GUIDANCE[status] ?? [
    "Check your ticket status.",
    "Follow the office’s instructions and refresh this page for an updated snapshot.",
  ];
  const deadline =
    current.check_in_deadline ?? current.ticket.check_in_deadline;
  const issuedAt =
    current.ticket.joined_at ??
    current.ticket.requested_at ??
    current.ticket.issued_at;
  return (
    <div className={s.page}>
      <PageHeader
        title={terminal ? "Your visit record" : "Your office ticket"}
        description={`${current.office.name} · ticket status and next steps`}
        breadcrumb={[
          { label: "Offices", href: "/student/services/offices" },
          {
            label: current.office.name,
            href: `/student/services/offices/${encodeURIComponent(current.office.code)}`,
          },
          { label: current.ticket.ticket_number },
        ]}
        actions={
          <Button
            variant="secondary"
            size="sm"
            disabled={busy !== null}
            onClick={refresh}
          >
            Refresh ticket
          </Button>
        }
      />
      <div className={s.columns}>
        <div className={s.stack}>
          <section className={s.ticket} aria-label="Your ticket">
            <header className={s.ticketHead}>
              <div className={s.toolbar}>
                <p className={s.eyebrow}>
                  CampusFlow / {terminal ? "Visit record" : "Office admission"}
                </p>
                <Badge
                  tone={
                    STATUS_TONES[current.ticket.status.toUpperCase()] ??
                    "neutral"
                  }
                >
                  {current.status_label ??
                    statusLabel(current.ticket.status.toUpperCase())}
                </Badge>
              </div>
              <p className={s.ticketNumber}>{current.ticket.ticket_number}</p>
              <h2 className="mt-4">{current.office.name}</h2>
              <p className={`${s.muted} mt-2`}>
                {current.ticket.subject ?? "No visit reason recorded"}
              </p>
            </header>
            <div className={s.ticketBody}>
              {!terminal ? (
                <dl className={s.ticketMetrics}>
                  <div>
                    <dt>People ahead</dt>
                    <dd>{current.people_ahead}</dd>
                  </div>
                  <div>
                    <dt>Estimated wait</dt>
                    <dd>{formatDuration(current.eta_seconds)}</dd>
                  </div>
                </dl>
              ) : (
                <>
                  <p className={s.eyebrow}>Visit status</p>
                  <h2 className="mt-3">{guidance[0]}</h2>
                  <p className={`${s.muted} mt-3`}>{guidance[1]}</p>
                </>
              )}
              {!terminal && current.expected_window ? (
                <p className={`${s.muted} mt-4`}>
                  Estimated window:{" "}
                  {formatClock(current.expected_window.starts_at)} –{" "}
                  {formatClock(current.expected_window.ends_at)}. Timing may
                  change.
                </p>
              ) : null}
              {!terminal && deadline ? (
                <p className={`${s.notice} mt-5`}>
                  Check-in deadline: {formatDate(deadline)} ·{" "}
                  <strong>{formatClock(deadline)}</strong>
                </p>
              ) : null}
              <dl className={s.facts}>
                <div>
                  <dt>Requested</dt>
                  <dd>
                    {formatDate(issuedAt)}
                    <span className={`block ${s.muted}`}>
                      {formatClock(issuedAt)}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt>Office location</dt>
                  <dd>
                    {[current.office.building_code, current.office.room_code]
                      .filter(Boolean)
                      .join(" · ") || "Not listed"}
                  </dd>
                </div>
              </dl>
              {current.ticket.notes ? (
                <details className={s.disclosure}>
                  <summary>Your visit notes</summary>
                  <p>{current.ticket.notes}</p>
                </details>
              ) : null}
            </div>
          </section>
          {feedback ? (
            <p
              role={feedback.error ? "alert" : "status"}
              className={feedback.error ? s.error : s.notice}
            >
              {feedback.message}
            </p>
          ) : null}
          {!terminal ? (
            <section className={s.panel} aria-label="Ticket actions">
              <p className={s.eyebrow}>Your next step</p>
              <h2 className="mt-3">{guidance[0]}</h2>
              <p className={`${s.muted} mb-5`}>{guidance[1]}</p>
              <div className={s.actions}>
                {current.can_check_in ? (
                  <Button
                    disabled={busy !== null}
                    loading={busy === "check-in"}
                    onClick={() => void act("check-in")}
                  >
                    Check in at the office
                  </Button>
                ) : null}
                {current.can_approaching ? (
                  <Button
                    variant="secondary"
                    disabled={busy !== null}
                    loading={busy === "approaching"}
                    onClick={() => void act("approaching")}
                  >
                    I am on my way
                  </Button>
                ) : null}
                {current.can_cancel ? (
                  <Button
                    variant="secondary"
                    disabled={busy !== null}
                    onClick={() => setConfirmCancel(true)}
                  >
                    Cancel ticket
                  </Button>
                ) : null}
                {current.office.room_code ? (
                  <Link
                    className={s.link}
                    href={`/student/campus/map?route=${encodeURIComponent(current.office.room_code)}`}
                  >
                    Directions to office{" "}
                    <WorkspaceIcon name="arrow" size={15} />
                  </Link>
                ) : null}
              </div>
              {!current.can_check_in && !current.can_approaching ? (
                <p className={`${s.muted} mt-4`}>
                  Arrival actions are not available for this ticket on the web.
                  Use the CampusFlow mobile app when the office asks you to
                  check in.
                </p>
              ) : null}
              {confirmCancel ? (
                <section
                  className={`${s.notice} mt-5`}
                  aria-label="Cancel this ticket"
                >
                  <h3>Release your place in line?</h3>
                  <p>
                    Your ticket will be cancelled only if the office service
                    confirms it.
                  </p>
                  <div className={`${s.actions} mt-3`}>
                    <Button
                      disabled={busy !== null}
                      loading={busy === "cancel"}
                      onClick={() => void act("cancel")}
                    >
                      Confirm cancellation
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={busy !== null}
                      onClick={() => setConfirmCancel(false)}
                    >
                      Keep my ticket
                    </Button>
                  </div>
                </section>
              ) : null}
            </section>
          ) : null}
          <section className={s.panel} aria-label="Ticket timeline">
            <h2>Visit timeline</h2>
            <p className={s.muted}>Events recorded by the office service.</p>
            {history.loading ? (
              <CardSkeleton rows={4} />
            ) : history.error ? (
              <ErrorState message={history.error} onRetry={history.reload} />
            ) : !history.data?.events.length ? (
              <p className={`${s.muted} mt-4`}>
                No events have been recorded yet.
              </p>
            ) : (
              <ol className={s.timeline}>
                {[...history.data.events]
                  .sort((a, b) => a.created_at.localeCompare(b.created_at))
                  .map((event, index) => (
                    <li key={`${event.type}-${event.created_at}-${index}`}>
                      <strong>
                        {EVENT_LABELS[event.type.toLowerCase()] ??
                          statusLabel(event.type.toUpperCase())}
                      </strong>
                      <p className={s.muted}>
                        <time dateTime={event.created_at}>
                          {formatDate(event.created_at)} ·{" "}
                          {formatClock(event.created_at)}
                        </time>
                      </p>
                    </li>
                  ))}
              </ol>
            )}
          </section>
        </div>
        <aside className={s.stack} aria-label="Office and ticket information">
          <section className={s.darkPanel}>
            <WorkspaceIcon name="queue" size={28} />
            <h2>
              {terminal
                ? "Keep your visit details."
                : "Your number. Your place."}
            </h2>
            <p className={s.muted}>
              {terminal
                ? "This page records the outcome returned by the campus service."
                : "This page shows a snapshot, not a guaranteed appointment time. Refresh for the latest status before leaving for the office."}
            </p>
          </section>
          <section className={s.panel}>
            <h2>{current.office.name}</h2>
            <p className={s.muted}>
              {[
                current.office.building_name ?? current.office.building_code,
                current.office.floor_name,
                current.office.room_code,
              ]
                .filter(Boolean)
                .join(" · ") || "Location not listed"}
            </p>
            <dl className={s.facts}>
              <div>
                <dt>Serving at once</dt>
                <dd>{current.office.concurrent_capacity ?? "—"}</dd>
              </div>
              <div>
                <dt>Typical service</dt>
                <dd>
                  {current.office.service_duration_minutes == null
                    ? "Not listed"
                    : `${current.office.service_duration_minutes} min`}
                </dd>
              </div>
            </dl>
            <Link
              className={s.link}
              href={`/student/services/offices/${encodeURIComponent(current.office.code)}`}
            >
              Office hours & details <WorkspaceIcon name="arrow" size={15} />
            </Link>
            <Link className={s.link} href="/student/services/offices">
              Browse all offices
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
