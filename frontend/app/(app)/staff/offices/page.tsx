"use client";
import { useState, useCallback } from "react";
import Link from "next/link";
import { staffApi } from "@/lib/api/endpoints";
import { useOperator } from "@/lib/use-operator";
import { useRealtimeEvent } from "@/lib/realtime/realtime-context";
import { Badge, Button, CardSkeleton } from "@/components/ui/kit";
import { ReadError } from "@/components/layout/student-companion";
import { WorkspaceIcon } from "@/components/layout/workspace-visual";
import s from "@/components/layout/staff-services.module.css";
export default function StaffOfficesPage() {
  const state = useOperator(useCallback(() => staffApi.offices(), []));
  const [query, setQuery] = useState("");
  useRealtimeEvent("staff:ops", state.refresh, []);
  const rows = state.data?.offices ?? [];
  const visible = rows.filter((o) =>
    `${o.code} ${o.name} ${o.room} ${o.location}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <div className={s.page}>
      <header className={s.head}>
        <div>
          <p className={s.eyebrow}>Staff workspace / service desks</p>
          <h1>Office services</h1>
          <p>
            The desks you serve, the requests awaiting attention. Open an office
            to work its current line.
          </p>
        </div>
        <Button
          variant="secondary"
          disabled={state.loading}
          onClick={state.refresh}
        >
          Refresh desks
        </Button>
      </header>
      <section className={s.intro}>
        <div>
          <p className={s.eyebrow}>A good service starts here</p>
          <h2>Make the next visit a little easier.</h2>
          <p className={s.muted}>
            Keep the request, the person and the next action together. Office
            hours and service policies stay with administration.
          </p>
        </div>
        <div className={s.emblem} aria-hidden="true">
          <WorkspaceIcon name="office" size={48} />
        </div>
      </section>
      {state.error ? (
        <ReadError message={state.error} retry={state.refresh} />
      ) : state.loading ? (
        <CardSkeleton rows={5} />
      ) : (
        <>
          <div className={s.bar}>
            <dl className={s.metrics}>
              <div>
                <dt>Desks in your scope</dt>
                <dd>{rows.length}</dd>
              </div>
              <div>
                <dt>Waiting for a call</dt>
                <dd>
                  {rows.every((o) => o.waiting !== null)
                    ? rows.reduce((n, o) => n + (o.waiting ?? 0), 0)
                    : "—"}
                </dd>
              </div>
              <div>
                <dt>Currently in service</dt>
                <dd>
                  {rows.every((o) => o.serving !== null)
                    ? rows.reduce((n, o) => n + (o.serving ?? 0), 0)
                    : "—"}
                </dd>
              </div>
            </dl>
            <span className={s.muted}>
              Last loaded counts · refresh to confirm
            </span>
          </div>
          <div className={s.tools}>
            <label>
              Find a service desk
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Office name, code or location"
              />
            </label>
            <span className={s.muted}>
              {visible.length} of {rows.length} desks
            </span>
          </div>
          {!rows.length ? (
            <section className={`${s.panel} ${s.empty}`}>
              <h3>No offices in your operating scope</h3>
              <p>
                Ask administration to review your office or room assignments.
              </p>
              <Link className={`${s.link} mt-4`} href="/staff/queues">
                Go to room queues →
              </Link>
            </section>
          ) : !visible.length ? (
            <section className={`${s.panel} ${s.empty}`}>
              <h3>No desks match your search</h3>
              <button className={`${s.link} mt-4`} onClick={() => setQuery("")}>
                Clear search
              </button>
            </section>
          ) : (
            <div className={s.cards}>
              {visible.map((o) => (
                <article className={s.deskCard} key={o.id}>
                  <div className={s.identity}>
                    <span className={s.code}>{o.code || "Desk"}</span>
                    <div>
                      <p className={s.eyebrow}>
                        Office / {o.room || "room not assigned"}
                      </p>
                      <h2>{o.name}</h2>
                    </div>
                  </div>
                  <p className={s.muted}>
                    {o.description ||
                      "Student support and administrative services."}
                  </p>
                  <p className={s.muted}>
                    {o.location || "Location not published"} · {o.duration} min
                    service setting
                  </p>
                  <dl className={s.metrics}>
                    <div>
                      <dt>Waiting</dt>
                      <dd>{o.waiting ?? "—"}</dd>
                    </div>
                    <div>
                      <dt>In service</dt>
                      <dd>{o.serving ?? "—"}</dd>
                    </div>
                    <div>
                      <dt>Done today</dt>
                      <dd>{o.completed ?? "—"}</dd>
                    </div>
                  </dl>
                  <footer>
                    <Badge tone={o.active ? "success" : "neutral"}>
                      {o.active ? "Active office" : "Inactive office"}
                    </Badge>
                    <Link
                      className={`${s.link} ${s.primary}`}
                      href={`/staff/offices/${o.id}`}
                    >
                      Open desk line →
                    </Link>
                  </footer>
                </article>
              ))}
            </div>
          )}
          <p className={s.muted}>
            “Active” describes office configuration, not current opening hours.
            Check the published weekly windows in each desk console.
          </p>
        </>
      )}
    </div>
  );
}
