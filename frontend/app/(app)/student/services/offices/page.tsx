"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  useAsync,
  formatDuration,
  formatDate,
  formatClock,
  STATUS_TONES,
  statusLabel,
} from "@/lib/hooks";
import { studentApi } from "@/lib/api/endpoints";
import {
  Badge,
  Button,
  CardSkeleton,
  EmptyState,
  ErrorState,
  Input,
} from "@/components/ui/kit";
import { WorkspaceIcon } from "@/components/layout/workspace-visual";
import { PageHeader } from "@/components/layout/app-shell";
import s from "@/components/layout/student-services.module.css";

export default function OfficesPage() {
  const summaries = useAsync(() => studentApi.offices(), []);
  const history = useAsync(() => studentApi.officeTickets(), []);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [allHistory, setAllHistory] = useState(false);
  const offices = [...(summaries.data?.offices ?? [])]
    .filter(
      (o) =>
        (filter !== "open" || o.is_open_now) &&
        `${o.office.name} ${o.office.code} ${o.office.description ?? ""}`
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
    )
    .sort(
      (a, b) =>
        Number(b.is_open_now) - Number(a.is_open_now) ||
        a.office.name.localeCompare(b.office.name),
    );
  const tickets = history.data?.tickets ?? [];

  return (
    <div className={s.page}>
      <PageHeader
        title="Administrative offices"
        description="Find the right desk. Plan your visit before you walk over."
      />
      <section className={s.hero} aria-label="Campus services">
        <div>
          <p className={s.eyebrow}>Support for the everyday</p>
          <h2>
            A little less waiting.
            <br />A simpler campus visit.
          </h2>
          <p className={s.muted}>
            Check office hours, review requirements and request your place in
            the service line.
          </p>
        </div>
        <Image
          src="/images/campus-workspace.webp"
          width={380}
          height={280}
          alt=""
        />
      </section>
      <div className={s.columns}>
        <section aria-label="Office directory" aria-busy={summaries.loading}>
          <div className={s.toolbar}>
            <Input
              aria-label="Search offices"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search office name, code or description"
            />
            <div
              className={s.controls}
              role="group"
              aria-label="Office opening filter"
            >
              <button
                className={s.chip}
                aria-pressed={filter === "all"}
                onClick={() => setFilter("all")}
              >
                All offices
              </button>
              <button
                className={s.chip}
                aria-pressed={filter === "open"}
                onClick={() => setFilter("open")}
              >
                Open now
              </button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={summaries.loading}
              onClick={summaries.reload}
            >
              Refresh offices
            </Button>
          </div>
          {summaries.loading ? (
            <CardSkeleton rows={7} />
          ) : summaries.error ? (
            <ErrorState message={summaries.error} onRetry={summaries.reload} />
          ) : !offices.length ? (
            <EmptyState
              title="No offices match this view"
              description="Try another search or include closed offices to check their hours."
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearch("");
                    setFilter("all");
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <>
              <p className={`${s.muted} mb-4`} role="status">
                {offices.length} offices shown · open offices first
              </p>
              <div className={s.stack}>
                {offices.map((summary) => {
                  const { office } = summary;
                  return (
                    <article className={s.officeRow} key={office.id}>
                      <div className={s.officeCode} aria-hidden="true">
                        {office.code.length <= 3 ? (
                          office.code
                        ) : (
                          <WorkspaceIcon name="office" size={25} />
                        )}
                      </div>
                      <div>
                        <div className={s.toolbar}>
                          <h3>{office.name}</h3>
                          <Badge
                            tone={summary.is_open_now ? "success" : "neutral"}
                          >
                            {summary.is_open_now ? "Open now" : "Closed"}
                          </Badge>
                        </div>
                        <p className={s.muted}>
                          {[
                            office.building_name ?? office.building_code,
                            office.floor_name,
                            office.room_code,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "Location not listed"}
                        </p>
                        {office.description ? (
                          <p className={`${s.muted} mt-2`}>
                            {office.description}
                          </p>
                        ) : null}
                        <div className={s.officeStats}>
                          <div>
                            <strong>
                              {summary.is_open_now
                                ? formatDuration(
                                    summary.estimated_wait_minutes * 60,
                                  )
                                : "—"}
                            </strong>
                            <span>Estimated wait</span>
                          </div>
                          <div>
                            <strong>{summary.counts.waiting}</strong>
                            <span>Waiting</span>
                          </div>
                          <div>
                            <strong>{summary.counts.in_service}</strong>
                            <span>In service</span>
                          </div>
                        </div>
                        {!summary.is_open_now && summary.next_opening ? (
                          <p className={`${s.muted} mb-3`}>
                            Next opening: {formatDate(summary.next_opening)} ·{" "}
                            {formatClock(summary.next_opening)}
                          </p>
                        ) : null}
                        {office.requires_appointment ? (
                          <p className={`${s.muted} mb-3`}>
                            Appointment required · contact the office before
                            visiting.
                          </p>
                        ) : office.requires_proximity_to_request ? (
                          <p className={`${s.muted} mb-3`}>
                            On-site location verification is required to request
                            a ticket.
                          </p>
                        ) : null}
                        <div className={s.actions}>
                          <Link
                            className={s.link}
                            href={`/student/services/offices/${encodeURIComponent(office.code)}`}
                          >
                            Office details{" "}
                            <WorkspaceIcon name="arrow" size={15} />
                          </Link>
                          {summary.my_ticket ? (
                            <Link
                              className={s.link}
                              href={`/student/services/offices/tickets/${summary.my_ticket.id}`}
                            >
                              Open your ticket
                            </Link>
                          ) : !office.requires_appointment ? (
                            <Link
                              className={s.link}
                              href={`/student/services/offices/${encodeURIComponent(office.code)}?request=1`}
                            >
                              Request a ticket
                            </Link>
                          ) : null}
                          {office.room_code ? (
                            <Link
                              className={s.link}
                              href={`/student/campus/map?route=${encodeURIComponent(office.room_code)}`}
                            >
                              Directions
                            </Link>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </section>
        <aside className={s.stack} aria-label="Your office visits">
          <section className={s.panel}>
            <div className={s.toolbar}>
              <h2>Your visits</h2>
              <WorkspaceIcon name="queue" size={22} />
            </div>
            <p className={s.muted}>
              Your recent tickets, separate from the office directory.
            </p>
            {history.loading ? (
              <CardSkeleton rows={3} />
            ) : history.error ? (
              <ErrorState message={history.error} onRetry={history.reload} />
            ) : !tickets.length ? (
              <p className={`${s.muted} mt-5`}>
                No office tickets yet. Choose a desk to get started.
              </p>
            ) : (
              <>
                <ul className="mt-5">
                  {tickets.slice(0, allHistory ? 50 : 5).map((ticket) => (
                    <li className={s.historyRow} key={ticket.id}>
                      <div className={s.toolbar}>
                        <strong>{ticket.ticket_number}</strong>
                        <Badge
                          tone={
                            STATUS_TONES[ticket.status.toUpperCase()] ??
                            "neutral"
                          }
                        >
                          {statusLabel(ticket.status.toUpperCase())}
                        </Badge>
                      </div>
                      <p className="text-sm font-semibold">
                        {ticket.office_name ?? "Office visit"}
                      </p>
                      <p className={s.muted}>
                        {ticket.subject ?? "No reason recorded"}
                      </p>
                      <p className={s.muted}>
                        {formatDate(
                          ticket.joined_at ??
                            ticket.requested_at ??
                            ticket.issued_at,
                        )}
                      </p>
                      <Link
                        className={s.link}
                        href={`/student/services/offices/tickets/${ticket.id}`}
                      >
                        View ticket <WorkspaceIcon name="arrow" size={14} />
                      </Link>
                    </li>
                  ))}
                </ul>
                {tickets.length > 5 ? (
                  <button
                    className={s.link}
                    onClick={() => setAllHistory((v) => !v)}
                  >
                    {allHistory
                      ? "Show fewer visits"
                      : `Show all ${tickets.length} loaded visits`}
                  </button>
                ) : null}
              </>
            )}
          </section>
          <section className={s.darkPanel}>
            <p className={s.eyebrow}>A prepared visit</p>
            <h2>Know before you go.</h2>
            <p className={s.muted}>
              Review the office’s requirements and service hours. A wait
              estimate can change as the line moves.
            </p>
            <Link className={s.link} href="/student/campus/map">
              Explore the campus map <WorkspaceIcon name="arrow" size={16} />
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
