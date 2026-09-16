"use client";

import { Suspense, use, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useAsync,
  formatClock,
  formatDuration,
  dayName,
  STATUS_TONES,
  statusLabel,
} from "@/lib/hooks";
import { officeApi } from "@/lib/api/endpoints";
import { ApiError, newIdempotencyKey } from "@/lib/api/client";
import {
  Badge,
  Button,
  CardSkeleton,
  ErrorState,
  Field,
  Input,
  Textarea,
} from "@/components/ui/kit";
import { PageHeader } from "@/components/layout/app-shell";
import { WorkspaceIcon } from "@/components/layout/workspace-visual";
import s from "@/components/layout/student-services.module.css";

export default function OfficeDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  return (
    <Suspense fallback={<CardSkeleton rows={7} />}>
      <OfficeDetail key={code} code={code} />
    </Suspense>
  );
}
function readBrowserPosition(): Promise<
  { lat: number; lng: number; accuracy_m: number; source: string } | undefined
> {
  if (!("geolocation" in navigator)) return Promise.resolve(undefined);
  return new Promise((resolve) =>
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracy_m: p.coords.accuracy,
          source: "gps",
        }),
      () => resolve(undefined),
      { timeout: 8000, maximumAge: 60_000 },
    ),
  );
}
function OfficeDetail({ code }: { code: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const office = useAsync(() => officeApi.detail(code), [code]);
  const [showForm, setShowForm] = useState(params.get("request") === "1");
  const [subject, setSubject] = useState("");
  const [notes, setNotes] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const lock = useRef(false);
  const requestKey = useRef<string | null>(null);
  const breadcrumb = [
    { label: "Offices", href: "/student/services/offices" },
    { label: code },
  ];
  async function request() {
    if (!office.data || lock.current || subject.trim().length < 3) return;
    lock.current = true;
    setRequesting(true);
    setFormError(null);
    requestKey.current ??= newIdempotencyKey("office");
    try {
      const fix = office.data.office.requires_proximity_to_request
        ? await readBrowserPosition()
        : undefined;
      const issued = await officeApi.request(
        office.data.office.id,
        { subject: subject.trim(), notes: notes.trim() || undefined, fix },
        requestKey.current,
      );
      if (!issued.ticket?.id)
        throw new Error(
          "The ticket response was incomplete. Refresh this office before trying again.",
        );
      router.push(
        `/student/services/offices/tickets/${encodeURIComponent(issued.ticket.id)}`,
      );
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.status >= 400 &&
        error.status < 500
      )
        requestKey.current = null;
      setFormError(
        error instanceof ApiError
          ? (error.firstError ?? error.message)
          : error instanceof Error
            ? error.message
            : "The request could not be confirmed. Please try again.",
      );
    } finally {
      lock.current = false;
      setRequesting(false);
    }
  }
  if (office.loading || office.error || !office.data)
    return (
      <div className={s.page}>
        <PageHeader title="Office details" breadcrumb={breadcrumb} />
        {office.loading ? (
          <CardSkeleton rows={8} />
        ) : (
          <ErrorState
            message={office.error ?? "Office details are unavailable."}
            onRetry={office.reload}
          />
        )}
      </div>
    );
  const summary = office.data;
  const { office: details } = summary;
  const ownTicket =
    summary.my_ticket &&
    String(summary.my_ticket.office_id) === String(details.id)
      ? summary.my_ticket
      : null;
  const full =
    summary.daily_capacity !== null &&
    summary.daily_capacity !== undefined &&
    summary.daily_capacity_used >= summary.daily_capacity;
  const unavailable = details.requires_appointment
    ? "This office serves by appointment. Contact the office to arrange your visit."
    : full
      ? "Today’s ticket capacity has been reached. Please check the next service window."
      : null;
  return (
    <div className={s.page}>
      <PageHeader
        title={details.name}
        description="Plan your visit, then request your place in line."
        breadcrumb={breadcrumb}
        actions={
          <Button
            variant="secondary"
            size="sm"
            disabled={requesting}
            onClick={office.reload}
          >
            Refresh office
          </Button>
        }
      />
      <section className={s.identity} aria-label="Office identity">
        <div className={s.identityMark}>
          <WorkspaceIcon name="office" size={45} />
        </div>
        <div>
          <p className={s.eyebrow}>Campus services / {details.code}</p>
          <h2>{details.name}</h2>
          <p className={s.muted}>
            {details.description ??
              "Administrative support for your campus day."}
          </p>
          <div className={`${s.controls} mt-3`}>
            <Badge tone={summary.is_open_now ? "success" : "neutral"}>
              {summary.is_open_now ? "Open now" : "Closed"}
            </Badge>
            <span className={s.muted}>
              {[
                details.building_name ?? details.building_code,
                details.floor_name,
                details.room_code,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>
        </div>
      </section>
      <div className={s.columns}>
        <div className={s.stack}>
          <section className={s.panel} aria-label="Plan and request your visit">
            {ownTicket ? (
              <>
                <p className={s.eyebrow}>Your place at this office</p>
                <h2 className="mt-3">Ticket {ownTicket.ticket_number}</h2>
                <Badge
                  tone={
                    STATUS_TONES[ownTicket.status.toUpperCase()] ?? "neutral"
                  }
                >
                  {statusLabel(ownTicket.status.toUpperCase())}
                </Badge>
                <p className={`${s.muted} mt-3`}>
                  {ownTicket.subject ??
                    "Your ticket is already in this office’s line."}
                </p>
                <Link
                  className={s.link}
                  href={`/student/services/offices/tickets/${ownTicket.id}`}
                >
                  Open your ticket <WorkspaceIcon name="arrow" size={16} />
                </Link>
              </>
            ) : (
              <>
                <div
                  className={s.preRequest}
                  data-form={showForm && !unavailable}
                >
                  <div className={s.step}>
                    <span>1</span>
                    <div>
                      <h2>Before you request</h2>
                      <p className={s.muted}>
                        Review today’s service information. The server confirms
                        your ticket number and place.
                      </p>
                    </div>
                  </div>
                  <dl className={s.facts}>
                    <div>
                      <dt>Estimated wait</dt>
                      <dd>
                        {summary.is_open_now
                          ? formatDuration(summary.estimated_wait_minutes * 60)
                          : "Office closed"}
                      </dd>
                    </div>
                    <div>
                      <dt>Currently waiting</dt>
                      <dd>{summary.counts.waiting}</dd>
                    </div>
                    <div>
                      <dt>Next number estimate</dt>
                      <dd>{summary.next_ticket_number ?? "Not available"}</dd>
                    </div>
                    <div>
                      <dt>Average service</dt>
                      <dd>{summary.average_service_minutes} min</dd>
                    </div>
                  </dl>
                  {summary.expected_window ? (
                    <p className={`${s.muted} mb-4`}>
                      Estimated service window:{" "}
                      {formatClock(summary.expected_window.starts_at)} –{" "}
                      {formatClock(summary.expected_window.ends_at)}. This may
                      change as the line moves.
                    </p>
                  ) : null}
                </div>
                {!summary.is_open_now ? (
                  <p className={`${s.notice} mb-4`}>
                    This office is closed right now. A ticket does not guarantee
                    service today. The campus service decides whether your
                    request can be issued.
                  </p>
                ) : null}
                {unavailable ? (
                  <p className={s.notice}>{unavailable}</p>
                ) : showForm ? (
                  <form
                    className={s.form}
                    onSubmit={(e) => {
                      e.preventDefault();
                      void request();
                    }}
                  >
                    <div className={s.step}>
                      <span>2</span>
                      <div>
                        <h2>Tell the desk what you need</h2>
                        <p className={s.muted}>
                          A short reason helps the team prepare. Include only
                          information needed for your visit.
                        </p>
                      </div>
                    </div>
                    <Field
                      label="Reason for your visit"
                      htmlFor="visit-subject"
                    >
                      <Input
                        id="visit-subject"
                        required
                        minLength={3}
                        maxLength={255}
                        value={subject}
                        disabled={requesting}
                        onChange={(e) => {
                          requestKey.current = null;
                          setSubject(e.target.value);
                        }}
                        placeholder="e.g. Enrolment correction"
                      />
                    </Field>
                    <Field
                      label="Additional context (optional)"
                      htmlFor="visit-notes"
                    >
                      <Textarea
                        id="visit-notes"
                        maxLength={500}
                        rows={4}
                        value={notes}
                        disabled={requesting}
                        onChange={(e) => {
                          requestKey.current = null;
                          setNotes(e.target.value);
                        }}
                        placeholder="What should the office know before you arrive?"
                      />
                    </Field>
                    {details.requires_proximity_to_request ? (
                      <p className={s.notice}>
                        This desk requires you to be on site. Your browser may
                        ask for location when you confirm; the server verifies
                        it against the office location.
                      </p>
                    ) : null}
                    {formError ? (
                      <p role="alert" className={s.error}>
                        {formError}
                      </p>
                    ) : null}
                    <div className={s.actions}>
                      <Button
                        type="submit"
                        loading={requesting}
                        disabled={subject.trim().length < 3}
                      >
                        Confirm request
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={requesting}
                        onClick={() => setShowForm(false)}
                      >
                        Back to office information
                      </Button>
                    </div>
                    <p className={s.muted}>
                      Nothing is issued until your request is confirmed. You can
                      cancel an active ticket from its ticket page.
                    </p>
                  </form>
                ) : (
                  <Button onClick={() => setShowForm(true)}>
                    Request a ticket
                  </Button>
                )}
              </>
            )}
          </section>
          <section className={s.panel}>
            <h2>Service hours</h2>
            <p className={`${s.muted} mb-5`}>
              Published campus service windows. Check the current office status
              before visiting.
            </p>
            {summary.windows?.length ? (
              summary.windows.map((window) => (
                <div className={s.window} key={window.id}>
                  <strong>{dayName(window.day_of_week)}</strong>
                  <div>
                    {window.opens_at.slice(0, 5)} –{" "}
                    {window.closes_at.slice(0, 5)}
                    <p className={s.muted}>
                      {window.capacity} tickets · {window.avg_service_minutes}{" "}
                      min average
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className={s.muted}>
                No service windows are published for this office.
              </p>
            )}
          </section>
          <section className={s.panel}>
            <h2>The current line</h2>
            <p className={s.muted}>
              Ticket numbers and states only. Refresh this office for an updated
              snapshot.
            </p>
            {summary.today_in_line === undefined ? (
              <p className={`${s.muted} mt-4`}>Line details are unavailable.</p>
            ) : summary.today_in_line.length ? (
              <div className={s.line}>
                {summary.today_in_line.map((row) => (
                  <span key={row.ticket_number}>
                    {row.ticket_number} ·{" "}
                    {statusLabel(row.status.toUpperCase())}
                  </span>
                ))}
              </div>
            ) : (
              <p className={`${s.muted} mt-4`}>
                No active tickets are listed. Service still depends on office
                hours and requirements.
              </p>
            )}
          </section>
        </div>
        <aside className={s.stack} aria-label="Visit requirements">
          <section className={s.darkPanel}>
            <WorkspaceIcon name="office" size={28} />
            <h2>Come prepared.</h2>
            <p className={s.muted}>
              {details.requires_appointment
                ? "Arrange an appointment with the office before your visit."
                : details.requires_proximity_to_request
                  ? "You need to be near this office to request a ticket."
                  : "Remote requests are supported by this desk. The campus service confirms whether a ticket can be issued."}
            </p>
            <p className={`${s.muted} mt-4`}>
              Check your ticket for the next action. Arrival verification may
              require the CampusFlow mobile app.
            </p>
          </section>
          <section className={s.panel}>
            <h2>Location & contact</h2>
            <p className={s.muted}>
              {[
                details.building_name ?? details.building_code,
                details.floor_name,
                details.room_code,
              ]
                .filter(Boolean)
                .join(" · ") || "Location not listed"}
            </p>
            {details.room_code ? (
              <Link
                className={s.link}
                href={`/student/campus/map?route=${encodeURIComponent(details.room_code)}`}
              >
                Directions to this office{" "}
                <WorkspaceIcon name="arrow" size={15} />
              </Link>
            ) : (
              <Link className={s.link} href="/student/campus/map">
                Browse campus map
              </Link>
            )}
            {details.contact_email ? (
              <p>
                <a
                  className={s.link}
                  href={`mailto:${encodeURIComponent(details.contact_email)}`}
                >
                  {details.contact_email}
                </a>
              </p>
            ) : null}
            {details.contact_phone ? (
              <p className={s.muted}>{details.contact_phone}</p>
            ) : null}
          </section>
          <section className={s.panel}>
            <h2>Service team</h2>
            {summary.staff?.length ? (
              <ul className="space-y-3">
                {summary.staff.map((member) => (
                  <li key={member.id}>
                    <p className="text-sm font-semibold">{member.name}</p>
                    <p className={s.muted}>{member.role}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={s.muted}>Staff details are not listed.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
