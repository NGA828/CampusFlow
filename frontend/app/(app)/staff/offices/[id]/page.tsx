"use client";
import { use, useCallback, useRef, useState } from "react";
import Link from "next/link";
import { staffApi } from "@/lib/api/endpoints";
import { verifyOfficeMutation } from "@/lib/api/staff-services";
import { useOperator } from "@/lib/use-operator";
import { useRealtimeEvent } from "@/lib/realtime/realtime-context";
import { dayName, statusLabel } from "@/lib/hooks";
import { Badge, Button, CardSkeleton } from "@/components/ui/kit";
import { ReadError, momentLabel } from "@/components/layout/student-companion";
import s from "@/components/layout/staff-services.module.css";
type Action = "check-in" | "start" | "complete" | "no-show";
export default function StaffOfficePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <DeskConsole key={id} id={id} />;
}
function DeskConsole({ id }: { id: string }) {
  const state = useOperator(useCallback(() => staffApi.officeLine(id), [id]));
  const [selected, setSelected] = useState("");
  const [filter, setFilter] = useState("all");
  const [action, setAction] = useState<Action | null>(null);
  const [reason, setReason] = useState("");
  const brief = useRef<HTMLElement>(null);
  useRealtimeEvent(`office:${id}`, state.refresh, [id]);
  useRealtimeEvent("staff:ops", state.refresh, []);
  const data = state.data;
  const active = (data?.line ?? []).filter(
    (t) => !["COMPLETED", "CANCELLED", "NO_SHOW", "EXPIRED"].includes(t.status),
  );
  const current = active.find((t) => t.id === selected);
  const shown = active.filter(
    (t) =>
      filter === "all" ||
      (filter === "waiting"
        ? ["WAITING", "REQUESTED", "APPROACHING"].includes(t.status)
        : !["WAITING", "REQUESTED", "APPROACHING"].includes(t.status)),
  );
  const execute = () => {
    if (!current || !action) return;
    const chosen = action;
    setAction(null);
    void state.act(
      async () => {
        const result =
          chosen === "check-in"
            ? await staffApi.officeCheckIn(current.id)
            : chosen === "start"
              ? await staffApi.officeStartService(current.id)
              : chosen === "complete"
                ? await staffApi.officeComplete(current.id)
                : await staffApi.officeNoShow(
                    current.id,
                    reason.trim() || undefined,
                  );
        verifyOfficeMutation(
          result.ticket,
          chosen === "complete"
            ? "COMPLETED"
            : chosen === "no-show"
              ? "NO_SHOW"
              : "IN_SERVICE",
          current.id,
        );
      },
      `${current.number}: ${chosen === "complete" ? "service completed" : chosen === "no-show" ? "marked no-show" : "service started"}.`,
    );
  };
  return (
    <div className={s.page}>
      <header className={s.head}>
        <div>
          <p className={s.eyebrow}>
            <Link href="/staff/offices">Office services</Link> / reception
            workspace
          </p>
          <h1>{data?.office.name || "Office console"}</h1>
          <p>
            {data
              ? [data.office.location, data.office.room]
                  .filter(Boolean)
                  .join(" · ") || "Location not published"
              : "Loading the office and its current requests."}
          </p>
        </div>
        <div className={s.actions}>
          <Button
            variant="secondary"
            disabled={state.loading || state.busy}
            onClick={state.refresh}
          >
            Refresh line
          </Button>
          <Button
            disabled={
              state.loading ||
              state.busy ||
              !data?.counts.waiting ||
              !!state.error
            }
            onClick={() =>
              void state.act(async () => {
                verifyOfficeMutation(
                  (await staffApi.officeCallNext(id)).called,
                  "CALLED",
                );
              }, "The next waiting office ticket was called.")
            }
          >
            Call next
          </Button>
        </div>
      </header>
      {state.feedback ? (
        <p
          className={state.feedback.error ? s.error : s.notice}
          role={state.feedback.error ? "alert" : "status"}
        >
          {state.feedback.text}
        </p>
      ) : null}
      {state.error ? (
        <ReadError message={state.error} retry={state.refresh} />
      ) : state.loading ? (
        <CardSkeleton rows={6} />
      ) : data ? (
        <>
          <div className={s.bar}>
            <dl className={s.metrics}>
              <div>
                <dt>Waiting</dt>
                <dd>{data.counts.waiting}</dd>
              </div>
              <div>
                <dt>Called</dt>
                <dd>{data.counts.called}</dd>
              </div>
              <div>
                <dt>In service</dt>
                <dd>{data.counts.in_service}</dd>
              </div>
              <div>
                <dt>Done today</dt>
                <dd>{data.office.completed ?? "—"}</dd>
              </div>
            </dl>
            <Badge tone={data.office.active ? "success" : "neutral"}>
              {data.office.active ? "Active office" : "Inactive office"}
            </Badge>
          </div>
          <div className={s.deskLayout}>
            <section
              id="desk-worklist"
              tabIndex={-1}
              className={`${s.panel} ${s.worklist}`}
            >
              <div className={s.bar}>
                <h2>Desk worklist</h2>
                <span className={s.muted}>{active.length} active requests</span>
              </div>
              <div className={s.tabs} aria-label="Ticket stage">
                {[
                  ["all", "All requests"],
                  ["waiting", "Waiting"],
                  ["desk", "At the desk"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    aria-pressed={filter === value}
                    onClick={() => setFilter(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {shown.length ? (
                <ol className={s.ticketList}>
                  {shown.map((t) => (
                    <li key={t.id}>
                      <button
                        className={s.ticket}
                        aria-pressed={t.id === selected}
                        aria-label={`${t.number} · ${t.name}`}
                        onClick={() => {
                          setSelected(t.id);
                          setAction(null);
                          setReason("");
                          requestAnimationFrame(() => brief.current?.focus());
                        }}
                      >
                        <span className={s.number}>
                          {t.number}
                          <small>#{t.position} in line</small>
                        </span>
                        <span>
                          <strong>{t.name}</strong>
                          <small>{t.subject}</small>
                        </span>
                        <span>
                          <Badge
                            tone={
                              t.status === "IN_SERVICE"
                                ? "success"
                                : t.status === "CALLED"
                                  ? "warning"
                                  : "neutral"
                            }
                          >
                            {statusLabel(t.status)}
                          </Badge>
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className={s.empty}>
                  <h3>
                    {active.length
                      ? "No tickets in this view"
                      : "No active office tickets"}
                  </h3>
                  <p>
                    {active.length
                      ? "Choose another stage to see the other requests."
                      : "Refresh when you are ready to check for new requests."}
                  </p>
                </div>
              )}
            </section>
            <aside
              ref={brief}
              tabIndex={-1}
              className={`${s.panel} ${s.brief}`}
              aria-label="Selected service request"
            >
              <p className={s.eyebrow}>Service brief</p>
              {current ? (
                <>
                  <span className={s.number}>{current.number}</span>
                  <h2>{current.name}</h2>
                  <p className={s.muted}>
                    {current.email || "Email not provided"}
                  </p>
                  <div className={s.subject}>
                    <p className={s.eyebrow}>What brings them here</p>
                    <p>{current.subject}</p>
                  </div>
                  <Badge tone="neutral">{statusLabel(current.status)}</Badge>
                  <dl className={s.facts}>
                    <div>
                      <dt>Requested</dt>
                      <dd>{momentLabel(current.joined)}</dd>
                    </div>
                    {current.called ? (
                      <div>
                        <dt>Called</dt>
                        <dd>{momentLabel(current.called)}</dd>
                      </div>
                    ) : null}
                    {current.started ? (
                      <div>
                        <dt>Service started</dt>
                        <dd>{momentLabel(current.started)}</dd>
                      </div>
                    ) : null}
                  </dl>
                  {action ? (
                    <div>
                      <h3>
                        {action === "no-show"
                          ? "Mark this request as no-show?"
                          : action === "complete"
                            ? "Complete this service?"
                            : "Confirm presence and start service?"}
                      </h3>
                      <p className={`${s.muted} mt-3`}>
                        {action === "check-in"
                          ? "This endpoint checks the student in and starts service together. Confirm only when the student is at your desk."
                          : action === "no-show"
                            ? "This ends the ticket. Check the student and current line before confirming."
                            : "The change is only confirmed after the server accepts it."}
                      </p>
                      {action === "no-show" ? (
                        <label className={`${s.field} mt-4`}>
                          Reason (optional)
                          <textarea
                            maxLength={500}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                          />
                        </label>
                      ) : null}
                      <div className={s.actions}>
                        <Button disabled={state.busy} onClick={execute}>
                          {action === "check-in" || action === "start"
                            ? "Confirm & start service"
                            : action === "complete"
                              ? "Confirm completion"
                              : "Confirm no-show"}
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => setAction(null)}
                        >
                          Go back
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className={s.actions}>
                      {["CALLED", "APPROACHING"].includes(current.status) ? (
                        <Button onClick={() => setAction("check-in")}>
                          Check in & start service
                        </Button>
                      ) : null}
                      {current.status === "CHECKED_IN" ? (
                        <Button onClick={() => setAction("start")}>
                          Start service
                        </Button>
                      ) : null}
                      {current.status === "IN_SERVICE" ? (
                        <Button onClick={() => setAction("complete")}>
                          Complete service
                        </Button>
                      ) : null}
                      {["CALLED", "APPROACHING", "CHECKED_IN"].includes(
                        current.status,
                      ) ? (
                        <Button
                          variant="secondary"
                          onClick={() => setAction("no-show")}
                        >
                          Mark no-show
                        </Button>
                      ) : null}
                      {["WAITING", "REQUESTED"].includes(current.status) ? (
                        <p className={s.muted}>
                          Use Call next to follow the server’s waiting order.
                          Selecting this request does not call it.
                        </p>
                      ) : null}
                    </div>
                  )}
                </>
              ) : (
                <div className={s.empty}>
                  <h3>Select a service request</h3>
                  <p>
                    Review the student, their subject and the next action here.
                  </p>
                </div>
              )}
              <a href="#desk-worklist" className={`${s.link} ${s.back}`}>
                {current ? "Back to worklist ↓" : "Choose a request ↓"}
              </a>
            </aside>
            <section className={`${s.panel} ${s.hours}`}>
              <h2>Published service windows</h2>
              <p className={`${s.muted} mt-3`}>
                Weekly schedule, not a live open-now indicator. Office
                configuration and capacity are managed by administration.
              </p>
              {data.windows.length ? (
                <div className={s.windows}>
                  {[...data.windows]
                    .sort(
                      (a, b) =>
                        ((a.day_of_week + 6) % 7) - ((b.day_of_week + 6) % 7) ||
                        a.opens_at.localeCompare(b.opens_at),
                    )
                    .map((w) => (
                      <article className={s.window} key={w.id}>
                        <strong>
                          {dayName(w.day_of_week)} · {w.opens_at}–{w.closes_at}
                        </strong>
                        <p>
                          {w.is_active && w.status === "active"
                            ? "Configured active"
                            : "Inactive"}{" "}
                          · capacity {w.capacity}
                        </p>
                      </article>
                    ))}
                </div>
              ) : (
                <p className={`${s.muted} mt-4`}>
                  No weekly windows published for this office.
                </p>
              )}
              <p className={`${s.muted} mt-4`}>
                Service setting: {data.office.duration} min · concurrent
                capacity {data.office.capacity}. Counts are from the last
                successful refresh.
              </p>
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
