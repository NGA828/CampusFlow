"use client";
import { useCallback } from "react";
import Link from "next/link";
import { staffApi } from "@/lib/api/endpoints";
import { useOperator } from "@/lib/use-operator";
import { useRealtimeEvent } from "@/lib/realtime/realtime-context";
import { statusLabel } from "@/lib/hooks";
import { Button } from "@/components/ui/kit";
import { WorkspaceIcon } from "@/components/layout/workspace-visual";
import {
  CoordinationHeader,
  ReadState,
  Empty,
  StatBlock,
} from "@/components/layout/coordination";
import s from "@/components/layout/coordination.module.css";
export default function StaffDashboardPage() {
  const state = useOperator(useCallback(() => staffApi.dashboard(), []));
  useRealtimeEvent("staff:ops", state.refresh, []);
  const data = state.data;
  const pending = data
    ? [
        ...data.pending_queue_actions.map((t) => ({
          id: `queue-${t.id}`,
          number: t.ticket_number,
          name: t.student_name,
          status: t.status,
          place: t.room_code || "Room queue",
          href: t.queue_id
            ? `/staff/queues/${encodeURIComponent(t.queue_id)}`
            : "/staff/queues",
        })),
        ...data.pending_office_actions.map((t) => ({
          id: `office-${t.id}`,
          number: t.ticket_number,
          name: t.student_name,
          status: t.status,
          place: t.office_name || "Office",
          href: t.office_id
            ? `/staff/offices/${encodeURIComponent(t.office_id)}`
            : "/staff/offices",
        })),
      ]
    : [];
  return (
    <div className={s.page}>
      <CoordinationHeader
        eyebrow="Staff / your working day"
        title="Service desk"
        description="The people waiting for your next step, the places you operate and the teaching day ahead."
      >
        <Button
          variant="secondary"
          onClick={state.refresh}
          disabled={state.loading}
        >
          Refresh overview
        </Button>
      </CoordinationHeader>
      <ReadState
        loading={state.loading}
        error={state.error}
        retry={state.refresh}
      />
      {!state.loading && !state.error && data ? (
        <>
          <div className={s.hero}>
            <div>
              <p className={s.eyebrow}>A clear start to your shift</p>
              <h2>People first. One next step at a time.</h2>
              <p>
                {pending.length} request{pending.length === 1 ? "" : "s"} in the
                loaded snapshot need review. Open the relevant console to
                confirm the current line before acting.
              </p>
              <div className={s.actions}>
                <Link className={s.link} href="/staff/queues">
                  Room queues →
                </Link>
                <Link className={s.link} href="/staff/offices">
                  Office services →
                </Link>
              </div>
            </div>
            <div className={s.art} aria-hidden="true">
              <WorkspaceIcon name="office" size={58} />
            </div>
          </div>
          <dl className={s.metrics}>
            <StatBlock
              label="Served today"
              value={data.kpis.served_today}
              hint="Room admissions + office completions"
            />
            <StatBlock
              label="Waiting for a call"
              value={data.kpis.waiting_now}
              hint="Across accessible queues and offices"
            />
            <StatBlock
              label="Enabled offices"
              value={data.kpis.offices_open}
              hint="Configuration, not current opening hours"
            />
          </dl>
          <div className={s.split}>
            <div>
              <section className={s.attention}>
                <div className={s.panelHead}>
                  <div>
                    <p className={s.eyebrow}>Your next steps</p>
                    <h2>Requests to review</h2>
                  </div>
                  <span className={s.pill}>
                    {pending.length} in this snapshot
                  </span>
                </div>
                {pending.length ? (
                  <ul className={s.stack}>
                    {pending.map((t) => (
                      <li className={s.row} key={t.id}>
                        <div>
                          <strong>
                            {t.number} · {t.name}
                          </strong>
                          <p>
                            {t.place} · {statusLabel(t.status)}
                          </p>
                        </div>
                        <Link
                          className={s.link}
                          href={t.href}
                          aria-label={`Review ${t.number}`}
                        >
                          Review request →
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Empty title="No requests awaiting review">
                    Your accessible lines returned no called, checked-in or
                    in-service requests.
                  </Empty>
                )}
              </section>
              <section className={s.panel}>
                <div className={s.panelHead}>
                  <h2>Your operational spaces</h2>
                  <span className={s.muted}>
                    {data.queues.length + data.offices.length} accessible spaces
                  </span>
                </div>
                <p className={s.eyebrow}>Room queues</p>
                {data.queues.length ? (
                  <ul className={s.stack}>
                    {data.queues.map((q) => (
                      <li className={s.row} key={q.queue_id}>
                        <div className={s.identity}>
                          <span className={s.initial}>
                            {q.room_code || "Q"}
                          </span>
                          <div>
                            <h3>{q.room_name || "Room queue"}</h3>
                            <p>
                              {q.building_code} · {q.floor_name} ·{" "}
                              {q.is_active ? "Enabled" : "Closed"}
                            </p>
                            <p>
                              {q.waiting} waiting · {q.occupying} called /
                              checked in
                            </p>
                          </div>
                        </div>
                        <Link
                          className={s.link}
                          href={`/staff/queues/${encodeURIComponent(q.queue_id)}`}
                        >
                          Open queue →
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Empty title="No queue scopes">
                    Ask administration to review your operational access.
                  </Empty>
                )}
                <div className={s.rule}>
                  <p className={s.eyebrow}>Office services</p>
                  {data.offices.length ? (
                    <ul className={s.stack}>
                      {data.offices.map((o) => (
                        <li className={s.row} key={o.office_id}>
                          <div>
                            <h3>{o.name}</h3>
                            <p>
                              {o.building_code} · {o.room_code || o.floor_name}
                            </p>
                            <p>
                              {o.waiting} waiting · {o.in_service} in service ·{" "}
                              {o.completed_today} completed today
                            </p>
                          </div>
                          <Link
                            className={s.link}
                            href={`/staff/offices/${encodeURIComponent(o.office_id)}`}
                          >
                            Open office →
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <Empty title="No office scopes">
                      No offices were returned for your current access.
                    </Empty>
                  )}
                </div>
              </section>
            </div>
            <aside className={s.rail}>
              <section className={`${s.panel} ${s.editor}`}>
                <p className={s.eyebrow}>Teaching / {data.campus_time.date}</p>
                <h2>Your teaching today</h2>
                <p className={s.muted}>
                  Campus clock at refresh: {data.campus_time.time}. Times below
                  use that clock.
                </p>
                {data.teaching_today.length ? (
                  <ul className={s.stack} style={{ marginTop: 20 }}>
                    {[...data.teaching_today]
                      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
                      .map((t) => (
                        <li key={t.id} className={s.row}>
                          <div>
                            <p className={s.eyebrow}>
                              {t.starts_at.slice(0, 5)} –{" "}
                              {t.ends_at.slice(0, 5)}
                            </p>
                            <h3>
                              {t.course_code} · {t.course_title}
                            </h3>
                            <p>
                              {t.room_code || "Room unassigned"} ·{" "}
                              {t.session_type}
                            </p>
                          </div>
                        </li>
                      ))}
                  </ul>
                ) : (
                  <Empty title="No teaching sessions today">
                    No sessions were returned for you in the current term.
                  </Empty>
                )}
                <Link className={`${s.link} ${s.back}`} href="/staff/timetable">
                  Review teaching week →
                </Link>
              </section>
              <section className={s.panel}>
                <p className={s.eyebrow}>Keep campus informed</p>
                <h2>A notice worth sharing?</h2>
                <p className={s.muted}>
                  Create an event or publish an announcement from the editorial
                  workspace.
                </p>
                <Link className={`${s.link} ${s.back}`} href="/staff/content">
                  Events & notices →
                </Link>
              </section>
            </aside>
          </div>
          <p className={`${s.muted} ${s.back}`}>
            Last-loaded snapshot. Connected updates request a refresh; delivery
            is not guaranteed. Permissions and line state are confirmed again by
            the server.
          </p>
        </>
      ) : null}
    </div>
  );
}
