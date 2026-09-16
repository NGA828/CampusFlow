"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { WorkspaceIcon } from "@/components/layout/workspace-visual";
import { useAsync, useDebounced } from "@/lib/hooks";
import { campusApi, studentApi } from "@/lib/api/endpoints";
import {
  Badge,
  Button,
  CardSkeleton,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Select,
} from "@/components/ui/kit";
import { PageHeader } from "@/components/layout/app-shell";
import s from "@/components/layout/student-discovery.module.css";

export default function RoomsPage() {
  const [search, setSearch] = useState("");
  const query = useDebounced(search, 300);
  const [type, setType] = useState("");
  const [admission, setAdmission] = useState("");
  const [capacity, setCapacity] = useState("");
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [view, setView] = useState<"grid" | "list">("grid");
  const queues = useAsync(() => studentApi.queueBoard(), []);
  const rooms = useAsync(
    () =>
      campusApi.rooms({
        q: query || undefined,
        type: type || undefined,
        admission_required: admission || undefined,
        per_page: 12,
        page,
      }),
    [query, type, admission, page],
  );
  const items = rooms.data?.items ?? [];
  const visible = items.filter(
    (room) => !capacity || room.capacity >= Number(capacity),
  );
  const meta = rooms.data?.meta;
  const reset = () => {
    setSearch("");
    setType("");
    setAdmission("");
    setCapacity("");
    setPage(1);
  };

  return (
    <div className={s.page}>
      <PageHeader
        title="Find a room"
        description="Explore campus spaces, then check a room’s schedule before you go."
      />
      <section className={s.hero} aria-label="Room discovery">
        <div>
          <p className={s.eyebrow}>Your campus, a little closer</p>
          <h2>
            A place to focus.
            <br />A space to find your people.
          </h2>
          <p className={s.muted}>
            From lecture halls to quiet study spaces. Find the right room, see
            what’s scheduled and plan your way there.
          </p>
        </div>
        <Image
          src="/images/campus-workspace.webp"
          alt=""
          width={440}
          height={310}
          className={s.heroArt}
        />
      </section>
      <div className={s.split}>
        <aside className={s.rail} aria-label="Room filters">
          <button
            className={s.filterToggle}
            aria-expanded={filtersOpen}
            aria-controls="room-filter-fields"
            onClick={() => setFiltersOpen((v) => !v)}
          >
            Filter rooms{" "}
            <span aria-hidden="true">{filtersOpen ? "−" : "+"}</span>
          </button>
          <div
            id="room-filter-fields"
            className={s.filterFields}
            data-open={filtersOpen}
          >
            <div className={s.toolbar}>
              <h2>Narrow your search</h2>
              <button type="button" className={s.link} onClick={reset}>
                Reset
              </button>
            </div>
            <Field label="Room type" htmlFor="room-type">
              <Select
                id="room-type"
                value={type}
                onChange={(e) => {
                  setType(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All room types</option>
                {[
                  "lecture",
                  "hall",
                  "lab",
                  "study",
                  "library",
                  "meeting",
                  "auditorium",
                  "office",
                  "service",
                ].map((t) => (
                  <option key={t} value={t}>
                    {t === "lab"
                      ? "Laboratory"
                      : t.charAt(0).toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Admission" htmlFor="room-admission">
              <Select
                id="room-admission"
                value={admission}
                onChange={(e) => {
                  setAdmission(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Any policy</option>
                <option value="true">Queue required</option>
              </Select>
            </Field>
            <Field label="Minimum seats on this page" htmlFor="room-capacity">
              <Input
                id="room-capacity"
                type="number"
                min={1}
                value={capacity}
                placeholder="Any capacity"
                onChange={(e) => setCapacity(e.target.value)}
              />
            </Field>
            <div className={s.railNote}>
              <WorkspaceIcon name="room" size={22} aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold">Check before you go</p>
              <p className={s.muted}>
                Availability is shown on each room’s detail page. A room listed
                here is not necessarily free right now.
              </p>
              <Link href="/student/campus/map" className={s.link}>
                Explore the map <WorkspaceIcon name="arrow" size={15} />
              </Link>
            </div>
          </div>
        </aside>
        <section aria-label="Room results" aria-busy={rooms.loading}>
          <div className={s.toolbar}>
            <div className={s.search}>
              <Field label="Search rooms" htmlFor="room-search">
                <Input
                  id="room-search"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search by room name or code"
                />
              </Field>
            </div>
            <div
              className="flex gap-1"
              role="group"
              aria-label="Results layout"
            >
              <button
                className={s.chip}
                aria-label="Grid view"
                aria-pressed={view === "grid"}
                onClick={() => setView("grid")}
              >
                <WorkspaceIcon name="grid" size={17} />
              </button>
              <button
                className={s.chip}
                aria-label="List view"
                aria-pressed={view === "list"}
                onClick={() => setView("list")}
              >
                <WorkspaceIcon name="list" size={17} />
              </button>
            </div>
          </div>
          {rooms.loading ? (
            <div className={s.grid}>
              <CardSkeleton rows={5} />
              <CardSkeleton rows={5} />
            </div>
          ) : rooms.error ? (
            <ErrorState message={rooms.error} onRetry={rooms.reload} />
          ) : (
            <>
              <div className={s.toolbar}>
                <p className={s.muted} role="status">
                  {visible.length} rooms shown
                  {meta
                    ? ` · ${meta.total} matching rooms across all pages`
                    : ""}
                </p>
              </div>
              {visible.length === 0 ? (
                <EmptyState
                  title="No rooms match those filters"
                  description={
                    capacity
                      ? "Try lowering the seat count, or check another page of results."
                      : "Try another room name, code or room type."
                  }
                  action={
                    <Button variant="secondary" onClick={reset}>
                      Reset filters
                    </Button>
                  }
                />
              ) : (
                <div
                  className={view === "grid" ? s.grid : `${s.stack} ${s.list}`}
                >
                  {visible.map((room) => {
                    const queue = queues.data?.queues.find(
                      (q) => q.room_id === room.id,
                    );
                    const kind = (
                      room.room_type ??
                      room.type ??
                      "Room"
                    ).replaceAll("_", " ");
                    return (
                      <article key={room.id} className={s.roomCard}>
                        <div className={s.roomTile}>
                          <div>
                            <p className={s.eyebrow}>{kind}</p>
                            <p className={s.roomCode}>{room.code}</p>
                          </div>
                          <WorkspaceIcon
                            name="room"
                            size={38}
                            strokeWidth={1.2}
                            aria-hidden="true"
                          />
                        </div>
                        <div className={s.roomBody}>
                          <div>
                            <h3>{room.name}</h3>
                            <p className={s.muted}>
                              {room.building_name ??
                                room.building_code ??
                                "Building not listed"}
                            </p>
                          </div>
                          <dl className={s.facts}>
                            <div>
                              <dt>Capacity</dt>
                              <dd>
                                {room.capacity == null
                                  ? "Not listed"
                                  : `${room.capacity} seats`}
                              </dd>
                            </div>
                            <div>
                              <dt>Floor</dt>
                              <dd>{room.floor_name ?? "Not listed"}</dd>
                            </div>
                            <div>
                              <dt>Admission</dt>
                              <dd>
                                {room.requires_admission
                                  ? "Queue required"
                                  : "No admission queue"}
                              </dd>
                            </div>
                            <div>
                              <dt>Queue snapshot</dt>
                              <dd>
                                {queues.loading
                                  ? "Checking…"
                                  : queues.error
                                    ? "Unavailable"
                                    : queue
                                      ? `${queue.waiting} waiting`
                                      : "No queue listed"}
                              </dd>
                            </div>
                          </dl>
                          <div className="flex flex-wrap gap-1.5">
                            {(room.amenities ?? room.features ?? [])
                              .slice(0, 3)
                              .map((a) => (
                                <Badge key={a} tone="neutral">
                                  {a.replaceAll("_", " ")}
                                </Badge>
                              ))}
                          </div>
                          <div className={s.actions}>
                            <Link
                              className={s.link}
                              href={`/student/campus/rooms/${encodeURIComponent(room.code)}`}
                            >
                              View room <WorkspaceIcon name="arrow" size={15} />
                            </Link>
                            <Link
                              className={s.link}
                              href={`/student/campus/map?route=${encodeURIComponent(room.code)}`}
                            >
                              Plan route
                            </Link>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
              {meta && meta.total_pages > 1 ? (
                <nav className={s.pagination} aria-label="Room pages">
                  <span>
                    Page {meta.page} of {meta.total_pages}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      Previous page
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={page >= meta.total_pages}
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
    </div>
  );
}
