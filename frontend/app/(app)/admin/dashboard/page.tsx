"use client";
import { useCallback } from "react";
import Link from "next/link";
import { adminApi } from "@/lib/api/endpoints";
import { metric } from "@/lib/api/coordination";
import { useOperator } from "@/lib/use-operator";
import { useRealtimeEvent } from "@/lib/realtime/realtime-context";
import { statusLabel, relativeTime } from "@/lib/hooks";
import { Button } from "@/components/ui/kit";
import {
  CoordinationHeader,
  ReadState,
  Empty,
  StatBlock,
} from "@/components/layout/coordination";
import s from "@/components/layout/coordination.module.css";
export default function AdminOverviewPage() {
  const state = useOperator(useCallback(() => adminApi.dashboard(), []));
  useRealtimeEvent("admin:ops", state.refresh, []);
  const d = state.data;
  return (
    <div className={s.page}>
      <CoordinationHeader
        eyebrow="Administration / campus oversight"
        title="Administration"
        description="Review the campus snapshot. Follow the evidence into infrastructure, services and account governance."
      >
        <Button
          variant="secondary"
          disabled={state.loading}
          onClick={state.refresh}
        >
          Refresh snapshot
        </Button>
        <Link className={s.link} href="/admin/alerts">
          Review alerts →
        </Link>
      </CoordinationHeader>
      <ReadState
        loading={state.loading}
        error={state.error}
        retry={state.refresh}
      />
      {!state.loading && !state.error && d ? (
        <>
          <section className={s.panel}>
            <div className={s.panelHead}>
              <div>
                <p className={s.eyebrow}>Your campus, at a glance</p>
                <h2>The infrastructure behind the day.</h2>
              </div>
              <p className={s.muted}>
                Generated {relativeTime(d.kpis.generated_at)}
                <br />A snapshot, not a system-health guarantee.
              </p>
            </div>
            <div className={s.inventory}>
              <Link href="/admin/campus">
                <span>Buildings / campus configuration</span>
                <strong>{metric(d.kpis.buildings) ?? "—"}</strong>
                <span>Review infrastructure →</span>
              </Link>
              <Link href="/admin/campus">
                <span>Rooms / learning & services</span>
                <strong>{metric(d.kpis.rooms) ?? "—"}</strong>
                <span>Manage campus rooms →</span>
              </Link>
              <Link href="/admin/users">
                <span>Students / people & access</span>
                <strong>{metric(d.kpis.students) ?? "—"}</strong>
                <span>Open user directory →</span>
              </Link>
            </div>
          </section>
          <dl className={s.metrics}>
            <StatBlock
              label="Room tickets in progress"
              value={metric(d.kpis.waiting_now) ?? "—"}
              hint="Waiting, called or checked in"
            />
            <StatBlock
              label="Office tickets in progress"
              value={metric(d.kpis.office_waiting_now) ?? "—"}
              hint="Waiting, called or in service"
            />
            <StatBlock
              label="Room tickets issued today"
              value={metric(d.kpis.issued_today) ?? "—"}
              hint="Server calendar day"
            />
          </dl>
          <div className={s.split}>
            <div>
              <section className={s.panel}>
                <div className={s.panelHead}>
                  <div>
                    <p className={s.eyebrow}>Service configuration & demand</p>
                    <h2>Room queue snapshot</h2>
                  </div>
                  <Link href="/admin/services" className={s.link}>
                    Configure services →
                  </Link>
                </div>
                <p className={s.muted}>
                  Load compares called / checked-in tickets with configured
                  admission capacity, not measured physical occupancy.
                </p>
                {d.live_queues.length ? (
                  <ul className={s.stack} style={{ marginTop: 20 }}>
                    {d.live_queues.map((q) => (
                      <li className={s.row} key={q.queue_id}>
                        <div style={{ flex: 1 }}>
                          <div
                            className={s.panelHead}
                            style={{ marginBottom: 0 }}
                          >
                            <h3>
                              {q.room_code} · {q.room_name}
                            </h3>
                            <span className={s.pill}>
                              {q.is_active ? "Enabled queue" : "Closed queue"}
                            </span>
                          </div>
                          <p>
                            {q.waiting} waiting · {q.occupying} called / checked
                            in · capacity {q.admission_capacity}
                          </p>
                          {q.admission_capacity > 0 ? (
                            <div className={s.bar} aria-hidden="true">
                              <span
                                style={{
                                  width: `${Math.min(100, Math.max(0, (q.occupying / q.admission_capacity) * 100))}%`,
                                }}
                              />
                            </div>
                          ) : (
                            <p>
                              Capacity unavailable or zero — review
                              configuration.
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Empty title="No configured queues">
                    Use service configuration to review campus admission
                    services.
                  </Empty>
                )}
              </section>
              <section className={s.panel}>
                <div className={s.panelHead}>
                  <h2>Building status register</h2>
                  <Link className={s.link} href="/admin/spatial">
                    Spatial configuration →
                  </Link>
                </div>
                {d.buildings.length ? (
                  <ul className={s.stack}>
                    {d.buildings.map((b) => (
                      <li className={s.row} key={b.id}>
                        <div className={s.identity}>
                          <span className={s.initial}>{b.code}</span>
                          <div>
                            <h3>{b.name}</h3>
                            <p>Published building configuration</p>
                          </div>
                        </div>
                        <span className={s.pill}>{statusLabel(b.status)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Empty title="No building records">
                    Create campus infrastructure before configuring navigation.
                  </Empty>
                )}
              </section>
              <section className={s.panel}>
                <div className={s.panelHead}>
                  <h2>Activity context</h2>
                  <Link className={s.link} href="/admin/analytics">
                    Open analytics →
                  </Link>
                </div>
                <dl className={s.two}>
                  <StatBlock
                    label="Navigation sessions today"
                    value={metric(d.kpis.navigation_sessions_today) ?? "—"}
                    hint="Sessions started, not completion rate"
                  />
                  <StatBlock
                    label="Office services completed today"
                    value={metric(d.overview.offices.completed_today) ?? "—"}
                    hint="Completed office tickets"
                  />
                </dl>
                <p className={`${s.scopeNote} ${s.back}`}>
                  Wait-time, no-show and navigation completion estimates are not
                  assumed when the API has no measurement. An unavailable metric
                  is not zero activity.
                </p>
              </section>
            </div>
            <aside className={s.rail}>
              <section className={`${s.panel} ${s.editor}`}>
                <p className={s.eyebrow}>Governance / audit trail</p>
                <h2>Recent activity</h2>
                {d.recent_audit.length ? (
                  <ol className={s.audit}>
                    {d.recent_audit.map((a) => (
                      <li key={a.id}>
                        <strong>{a.actor_name || "System"}</strong>
                        <p>{statusLabel(a.action)}</p>
                        <p>
                          {a.entity_type || "Entity not supplied"} ·{" "}
                          {relativeTime(a.created_at)}
                        </p>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <Empty title="No audit entries returned">
                    This snapshot contains no recent audit records.
                  </Empty>
                )}
                <Link className={`${s.link} ${s.back}`} href="/admin/settings">
                  Open audit log →
                </Link>
              </section>
              <section className={s.panel}>
                <p className={s.eyebrow}>People & policy</p>
                <h2>Keep access intentional.</h2>
                <p className={s.muted}>
                  Review account roles and the resource assignments that support
                  staff work.
                </p>
                <Link className={`${s.link} ${s.back}`} href="/admin/users">
                  Manage people →
                </Link>
              </section>
            </aside>
          </div>
        </>
      ) : null}
    </div>
  );
}
