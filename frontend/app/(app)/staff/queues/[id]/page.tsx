"use client";
import { use, useCallback, useRef, useState } from "react";
import Link from "next/link";
import { staffApi } from "@/lib/api/endpoints";
import { useOperator } from "@/lib/use-operator";
import { useRealtimeEvent } from "@/lib/realtime/realtime-context";
import { statusLabel } from "@/lib/hooks";
import { Badge, Button, CardSkeleton } from "@/components/ui/kit";
import { ReadError, momentLabel } from "@/components/layout/student-companion";
import type { QueueLineRow } from "@/lib/api/types";
import s from "@/components/layout/campus-operations.module.css";
type Action = "presence" | "admit" | "complete" | "no-show";
export default function StaffQueuePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <QueueConsole key={id} id={id} />;
}
function QueueConsole({ id }: { id: string }) {
  const detail = useOperator(useCallback(() => staffApi.queueLine(id), [id]));
  const actionPanel = useRef<HTMLElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Action | null>(null);
  const [reason, setReason] = useState("");
  useRealtimeEvent(`queue:${id}`, detail.refresh, [id]);
  useRealtimeEvent("staff:ops", detail.refresh, []);
  const queue = detail.data?.queue;
  const active = (detail.data?.line ?? []).filter(
    (t) => !["COMPLETED", "CANCELLED", "EXPIRED", "NO_SHOW"].includes(t.status),
  );
  const row = active.find((t) => t.id === selected);
  const waiting = active.filter((t) => t.status === "WAITING");
  const verify = (t: QueueLineRow, expected: string, ticketId?: string) => {
    if (
      !t?.id ||
      (ticketId && t.id !== ticketId) ||
      t.status?.toUpperCase() !== expected
    )
      throw new Error(
        "The ticket change could not be confirmed. Review the refreshed line before retrying.",
      );
  };
  const execute = () => {
    if (!row || !confirm) return;
    const action = confirm;
    const ticketId = row.id;
    setConfirm(null);
    void detail.act(
      async () => {
        const response =
          action === "presence"
            ? await staffApi.staffCheckIn(ticketId)
            : action === "admit"
              ? await staffApi.admit(ticketId)
              : action === "complete"
                ? await staffApi.complete(ticketId)
                : await staffApi.noShow(ticketId, reason.trim() || undefined);
        verify(
          response.ticket,
          {
            presence: "CHECKED_IN",
            admit: "ADMITTED",
            complete: "COMPLETED",
            "no-show": "NO_SHOW",
          }[action],
          ticketId,
        );
      },
      `${row.ticket_number}: ${{ presence: "presence confirmed", admit: "admission confirmed", complete: "service completed", "no-show": "marked as no-show" }[action]}.`,
    );
  };
  return (
    <div className={s.page}>
      <header className={s.heading}>
        <div>
          <p className={s.eyebrow}>
            <Link href="/staff/queues">Room queues</Link> / operator console
          </p>
          <h1>{queue ? `${queue.room_code} queue` : "Queue console"}</h1>
          <p>
            {queue
              ? `${queue.room_name} · ${[queue.building_code, queue.floor_name].filter(Boolean).join(" · ")}`
              : "Loading your assigned room and its current line."}
          </p>
        </div>
        <div className={s.actions}>
          <Button
            variant="secondary"
            onClick={detail.refresh}
            disabled={detail.busy || detail.loading}
          >
            Refresh line
          </Button>
          <Button
            disabled={
              detail.busy || detail.loading || !waiting.length || !!detail.error
            }
            onClick={() =>
              void detail.act(async () => {
                verify((await staffApi.callNext(id)).called, "CALLED");
              }, "The next waiting student was called.")
            }
            loading={detail.busy}
          >
            Call next
          </Button>
        </div>
      </header>
      {detail.feedback ? (
        <p
          role={detail.feedback.error ? "alert" : "status"}
          className={detail.feedback.error ? s.error : s.notice}
        >
          {detail.feedback.text}
        </p>
      ) : null}
      {detail.error ? (
        <ReadError message={detail.error} retry={detail.refresh} />
      ) : detail.loading ? (
        <CardSkeleton rows={6} />
      ) : queue ? (
        <>
          <dl className={s.stats}>
            <div>
              <dt>Waiting to be called</dt>
              <dd>{detail.data?.counts.waiting}</dd>
            </div>
            <div>
              <dt>Checked in</dt>
              <dd>{detail.data?.counts.checked_in}</dd>
            </div>
            <div>
              <dt>Inside the room</dt>
              <dd>
                {queue.occupying}
                <small className={s.muted}>
                  {" "}
                  {queue.admission_capacity > 0
                    ? `/ ${queue.admission_capacity}`
                    : ""}
                </small>
              </dd>
            </div>
          </dl>
          <div className={`${s.split} ${s.console}`}>
            <section
              id="current-line"
              tabIndex={-1}
              className={s.main}
              aria-label="Queue workbench"
            >
              <div className={s.bar}>
                <h2>Current line</h2>
                <Badge tone={queue.is_active ? "success" : "neutral"}>
                  {queue.is_active
                    ? "Open to new joins"
                    : "Closed to new joins"}
                </Badge>
              </div>
              <p className={s.muted}>
                Select a ticket to act. Call next always follows the server’s
                waiting order.
              </p>
              {active.length ? (
                <div className={s.board}>
                  {[
                    { title: "01 / Waiting", items: waiting },
                    {
                      title: "02 / Arrival & check-in",
                      items: active.filter(
                        (t) => !["WAITING", "ADMITTED"].includes(t.status),
                      ),
                    },
                    {
                      title: "03 / Inside",
                      items: active.filter((t) => t.status === "ADMITTED"),
                    },
                  ].map((lane) => (
                    <section key={lane.title} className={s.lane}>
                      <h2>
                        {lane.title} · {lane.items.length}
                      </h2>
                      {!lane.items.length ? (
                        <p className={s.muted}>No tickets in this stage.</p>
                      ) : (
                        lane.items.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            disabled={detail.busy}
                            aria-pressed={selected === t.id}
                            onClick={() => {
                              setSelected(t.id);
                              setConfirm(null);
                              setReason("");
                              requestAnimationFrame(() =>
                                actionPanel.current?.focus(),
                              );
                            }}
                          >
                            <span className={s.ticketNumber}>
                              {t.ticket_number} · #{t.position}
                            </span>
                            <p className={s.ticketName}>{t.student_name}</p>
                            <span className={s.ticketState}>
                              {statusLabel(t.status)}
                            </span>
                          </button>
                        ))
                      )}
                    </section>
                  ))}
                </div>
              ) : (
                <div className={`${s.panel} ${s.empty}`}>
                  <h3>Nobody is in the line</h3>
                  <p>
                    Refresh to check for new tickets. Existing occupancy may
                    include people without an active ticket.
                  </p>
                </div>
              )}
              <p className={s.muted}>
                Last successful refresh. Connection events request an update;
                use Refresh line whenever you need to confirm the current state.
              </p>
            </section>
            <aside className={s.rail}>
              <section
                ref={actionPanel}
                tabIndex={-1}
                className={`${s.panel} ${s.operator}`}
                aria-label="Selected ticket actions"
              >
                <p className={s.eyebrow}>Ticket workspace</p>
                {row ? (
                  <>
                    <span className={s.ticketNumber}>{row.ticket_number}</span>
                    <h2>{row.student_name}</h2>
                    <p className={s.muted}>
                      {row.student_email || "Email not provided"}
                    </p>
                    <p className={`${s.muted} mt-3`}>
                      {statusLabel(row.status)} · joined{" "}
                      {momentLabel(row.issued_at)}
                    </p>
                    {row.check_in_deadline ? (
                      <p className={s.muted}>
                        Check-in deadline: {momentLabel(row.check_in_deadline)}
                      </p>
                    ) : null}
                    {confirm ? (
                      <div className="mt-5">
                        <h3>
                          {
                            {
                              presence: "Confirm student is here?",
                              admit: "Admit this student?",
                              complete: "Complete this ticket?",
                              "no-show": "Mark this student absent?",
                            }[confirm]
                          }
                        </h3>
                        <p className={`${s.muted} mt-2`}>
                          {confirm === "presence"
                            ? "Only confirm presence when the student is at your desk."
                            : confirm === "no-show"
                              ? "This ends the ticket. Check the student and deadline before continuing."
                              : "The server will validate the ticket and room capacity."}
                        </p>
                        {confirm === "no-show" ? (
                          <label className="mt-3 block text-xs">
                            Reason (optional)
                            <textarea
                              className={s.reason}
                              maxLength={500}
                              value={reason}
                              onChange={(e) => setReason(e.target.value)}
                            />
                          </label>
                        ) : null}
                        <div className={s.actions}>
                          <Button disabled={detail.busy} onClick={execute}>
                            Confirm{" "}
                            {confirm === "presence" ? "check-in" : confirm}
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => setConfirm(null)}
                          >
                            Go back
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className={s.actions}>
                        {["WAITING", "CALLED", "NAVIGATING"].includes(
                          row.status,
                        ) ? (
                          <Button
                            disabled={detail.busy}
                            onClick={() => setConfirm("presence")}
                          >
                            Confirm desk check-in
                          </Button>
                        ) : null}
                        {row.status === "CHECKED_IN" ? (
                          <Button
                            disabled={detail.busy}
                            onClick={() => setConfirm("admit")}
                          >
                            Admit to room
                          </Button>
                        ) : null}
                        {row.status === "ADMITTED" ? (
                          <Button
                            disabled={detail.busy}
                            onClick={() => setConfirm("complete")}
                          >
                            Complete service
                          </Button>
                        ) : null}
                        {["CALLED", "NAVIGATING", "CHECKED_IN"].includes(
                          row.status,
                        ) ? (
                          <Button
                            variant="secondary"
                            disabled={detail.busy}
                            onClick={() => setConfirm("no-show")}
                          >
                            Mark no-show
                          </Button>
                        ) : null}
                        {row.status === "WAITING" ? (
                          <p className={s.muted}>
                            To call a student, use Call next above. It selects
                            the next waiting ticket, not the selected card.
                          </p>
                        ) : null}
                      </div>
                    )}
                  </>
                ) : (
                  <div className={s.empty}>
                    <h3>Select a ticket</h3>
                    <p>
                      Student details and the next service action will appear
                      here.
                    </p>
                  </div>
                )}
                <a href="#current-line" className={`${s.link} ${s.backLine}`}>
                  {row ? "Back to current line ↓" : "Choose a ticket ↓"}
                </a>
              </section>
              <section className={s.panel}>
                <h3>Published queue policy</h3>
                <dl className={s.policy}>
                  <div>
                    <dt>Admission capacity</dt>
                    <dd>
                      {queue.admission_capacity > 0
                        ? `${queue.admission_capacity} people`
                        : "No positive cap published"}
                    </dd>
                  </div>
                  <div>
                    <dt>Average service setting</dt>
                    <dd>
                      {Math.round(queue.avg_service_seconds / 60)} min · not a
                      wait guarantee
                    </dd>
                  </div>
                  <div>
                    <dt>Joining proximity</dt>
                    <dd>
                      {queue.requires_proximity_to_join
                        ? `Within ${queue.proximity_radius_m} m`
                        : "No proximity requirement"}
                    </dd>
                  </div>
                </dl>
                <p className={`${s.muted} mt-4`}>
                  Policy changes belong in administration. The server remains
                  authoritative for every transition.
                </p>
              </section>
            </aside>
          </div>
        </>
      ) : null}
    </div>
  );
}
