"use client";
import Link from "next/link";
import { useCallback, useState } from "react";
import { staffApi } from "@/lib/api/endpoints";
import { useOperator } from "@/lib/use-operator";
import { useRealtimeEvent } from "@/lib/realtime/realtime-context";
import { Badge, Button, CardSkeleton } from "@/components/ui/kit";
import { ReadError } from "@/components/layout/student-companion";
import s from "@/components/layout/campus-operations.module.css";

export default function StaffQueuesPage() {
  const queues = useOperator(useCallback(() => staffApi.queues(), []));
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  useRealtimeEvent("staff:ops", queues.refresh, []);
  const rows = queues.data?.queues ?? [];
  const shown = rows.filter(
    (q) =>
      (filter === "all" || q.is_active === (filter === "open")) &&
      `${q.room_code} ${q.room_name} ${q.building_code}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <div className={s.page}>
      <header className={s.heading}>
        <div>
          <p className={s.eyebrow}>Operations / room services</p>
          <h1>Room queues</h1>
          <p>
            A clear view of the lines you run. Choose a room to manage its next
            admission.
          </p>
        </div>
        <Button
          variant="secondary"
          disabled={queues.busy || queues.loading}
          onClick={queues.refresh}
        >
          Refresh queues
        </Button>
      </header>
      {queues.feedback ? (
        <p
          role={queues.feedback.error ? "alert" : "status"}
          className={queues.feedback.error ? s.error : s.notice}
        >
          {queues.feedback.text}
        </p>
      ) : null}
      {queues.error ? (
        <ReadError message={queues.error} retry={queues.refresh} />
      ) : queues.loading ? (
        <CardSkeleton rows={5} />
      ) : (
        <>
          <dl className={s.stats}>
            <div>
              <dt>Assigned lines</dt>
              <dd>{rows.length}</dd>
            </div>
            <div>
              <dt>Open for joins</dt>
              <dd>{rows.filter((q) => q.is_active).length}</dd>
            </div>
            <div>
              <dt>Students waiting</dt>
              <dd>{rows.reduce((n, q) => n + q.waiting, 0)}</dd>
            </div>
          </dl>
          <div className={s.split}>
            <section className={s.panel} aria-label="Assigned queue directory">
              <div className={s.bar}>
                <h2>Your queue directory</h2>
                <span className={s.muted}>
                  {shown.length} of {rows.length} lines
                </span>
              </div>
              <div className={`${s.tools} mt-5`}>
                <label>
                  Find a room
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Room, name or building"
                  />
                </label>
                <label>
                  Queue state
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <option value="all">All lines</option>
                    <option value="open">Open</option>
                    <option value="closed">Closed</option>
                  </select>
                </label>
              </div>
              {!rows.length ? (
                <div className={s.empty}>
                  <h3>No queues assigned to you</h3>
                  <p>
                    Ask administration to assign a room and configure its queue.
                  </p>
                </div>
              ) : !shown.length ? (
                <div className={s.empty}>
                  <h3>No matching queues</h3>
                  <p>Try another room or queue state.</p>
                  <button
                    className={s.link}
                    onClick={() => {
                      setSearch("");
                      setFilter("all");
                    }}
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                shown.map((q) => (
                  <article
                    className={s.row}
                    key={q.queue_id}
                    aria-label={`${q.room_code} queue`}
                  >
                    <div>
                      <div className={s.identity}>
                        <span className={s.code}>{q.room_code}</span>
                        <div className={s.details}>
                          <h3>{q.room_name}</h3>
                          <p>
                            {[q.building_code, q.floor_name]
                              .filter(Boolean)
                              .join(" · ") || "Location not provided"}
                          </p>
                        </div>
                        <Badge tone={q.is_active ? "success" : "neutral"}>
                          {q.is_active ? "Open" : "Closed"}
                        </Badge>
                      </div>
                      <div className={s.meta}>
                        <span>
                          <strong>{q.waiting}</strong> waiting
                        </span>
                        <span>
                          <strong>{q.checked_in}</strong> checked in
                        </span>
                        <span>
                          <strong>
                            {q.occupying}
                            {q.admission_capacity > 0
                              ? ` / ${q.admission_capacity}`
                              : ""}
                          </strong>{" "}
                          in room
                        </span>
                      </div>
                    </div>
                    <div className={s.actions}>
                      <Link
                        className={`${s.link} ${s.primary}`}
                        href={`/staff/queues/${q.queue_id}`}
                      >
                        Open console →
                      </Link>
                      <Button
                        variant="secondary"
                        disabled={queues.busy}
                        onClick={() =>
                          void queues.act(
                            async () => {
                              const result = await staffApi.setQueueOpen(
                                q.queue_id,
                                !q.is_active,
                              );
                              if (
                                result.queue?.id !== q.queue_id ||
                                result.queue.is_open !== !q.is_active
                              )
                                throw new Error(
                                  "The queue change could not be verified. Refresh before retrying.",
                                );
                            },
                            q.is_active
                              ? `${q.room_code} closed to new joins. Existing tickets remain.`
                              : `${q.room_code} opened to new joins.`,
                          )
                        }
                      >
                        {q.is_active ? "Close queue" : "Open queue"}
                      </Button>
                    </div>
                  </article>
                ))
              )}
            </section>
            <aside className={s.rail}>
              <section className={s.panel}>
                <p className={s.eyebrow}>Operator notes</p>
                <h2>Keep the line moving.</h2>
                <dl className={s.policy}>
                  <div>
                    <dt>01 / Choose a queue</dt>
                    <dd>
                      Open its console to see students and their current ticket
                      states.
                    </dd>
                  </div>
                  <div>
                    <dt>02 / Call & admit</dt>
                    <dd>
                      Call the next waiting student, confirm presence at the
                      desk, then admit.
                    </dd>
                  </div>
                  <div>
                    <dt>03 / Close new joins</dt>
                    <dd>
                      Closing a queue does not cancel existing tickets or finish
                      their service.
                    </dd>
                  </div>
                </dl>
              </section>
              <section className={s.panel}>
                <h3>Your assigned scope</h3>
                <p className={`${s.muted} mt-3`}>
                  This list is scoped by the server. Capacity and proximity
                  rules are managed by administration.
                </p>
                <p className={`${s.muted} mt-3`}>
                  Counts reflect the last successful refresh, not a guaranteed
                  live feed.
                </p>
              </section>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
