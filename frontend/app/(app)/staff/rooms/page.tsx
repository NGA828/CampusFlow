"use client";
import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { staffApi } from "@/lib/api/endpoints";
import type { ManagedRoom } from "@/lib/api/staff-services";
import { useOperator } from "@/lib/use-operator";
import { Badge, Button, CardSkeleton } from "@/components/ui/kit";
import { ReadError, errorMessage } from "@/components/layout/student-companion";
import { WorkspaceIcon } from "@/components/layout/workspace-visual";
import s from "@/components/layout/staff-services.module.css";
const statuses = ["available", "occupied", "closed", "maintenance"];
export default function StaffRoomsPage() {
  const [search, setSearch] = useState(""),
    [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState("");
  const [next, setNext] = useState("");
  const [formError, setFormError] = useState("");
  const panel = useRef<HTMLElement>(null);
  const state = useOperator(
    useCallback(
      async () => ({
        ...(await staffApi.rooms({
          q: query || undefined,
          page,
          per_page: 24,
        })),
        query,
        requestedPage: page,
      }),
      [query, page],
    ),
  );
  const data =
    state.data?.query === query && state.data.requestedPage === page
      ? state.data
      : null;
  const current = data?.items.find((r) => r.id === selected);
  return (
    <div className={s.page}>
      <header className={s.head}>
        <div>
          <p className={s.eyebrow}>Campus operations / room status</p>
          <h1>Room management</h1>
          <p>
            Review campus rooms. Change availability only where your account has
            a server-authorized assignment.
          </p>
        </div>
        <Button
          variant="secondary"
          disabled={state.busy || state.loading}
          onClick={state.refresh}
        >
          Refresh rooms
        </Button>
      </header>
      <section className={s.intro}>
        <div>
          <p className={s.eyebrow}>The right status, in the right place</p>
          <h2>Keep the room board useful.</h2>
          <p className={s.muted}>
            A status update helps others plan. Capacity, geometry and access
            rules remain administrative settings; queue admission is a separate
            workflow.
          </p>
        </div>
        <div className={s.emblem}>
          <WorkspaceIcon name="room" size={45} />
        </div>
      </section>
      {state.feedback ? (
        <p
          className={state.feedback.error ? s.error : s.notice}
          role={state.feedback.error ? "alert" : "status"}
        >
          {state.feedback.text}
        </p>
      ) : null}
      <form
        className={s.tools}
        onSubmit={(e) => {
          e.preventDefault();
          if (state.busy) return;
          setSelected("");
          setQuery(search.trim());
          setPage(1);
          if (search.trim() === query && page === 1) state.refresh();
        }}
      >
        <label>
          Search campus rooms
          <input
            type="search"
            placeholder="Room name or code"
            maxLength={200}
            value={search}
            disabled={state.busy}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <Button type="submit" disabled={state.busy}>
          Search rooms
        </Button>
        {query ? (
          <Button
            variant="secondary"
            disabled={state.busy}
            onClick={() => {
              setSearch("");
              setQuery("");
              setPage(1);
              setSelected("");
            }}
          >
            Clear search
          </Button>
        ) : null}
      </form>
      {state.error ? (
        <ReadError message={state.error} retry={state.refresh} />
      ) : state.loading || !data ? (
        <CardSkeleton rows={5} />
      ) : (
        <div className={s.roomLayout}>
          <section
            id="room-results"
            tabIndex={-1}
            className={s.panel}
            aria-label="Room results"
          >
            <div className={s.bar}>
              <h2>{query ? "Matching rooms" : "Campus room directory"}</h2>
              <span className={s.muted}>
                {data.meta.total} results · page {data.meta.page} of{" "}
                {data.meta.total_pages}
              </span>
            </div>
            {data.items.length ? (
              <div className={s.roomRows}>
                {data.items.map((room) => (
                  <article className={s.roomRow} key={room.id}>
                    <span className={s.code}>{room.code}</span>
                    <div>
                      <h3>{room.name}</h3>
                      <p className={s.muted}>
                        {[room.building_code, room.floor_name]
                          .filter(Boolean)
                          .join(" · ") || "Location not provided"}{" "}
                        · {room.capacity} seats
                      </p>
                      <p className={s.muted}>
                        {room.room_type} ·{" "}
                        {room.can_update_status
                          ? "Status update permitted"
                          : "View only"}
                      </p>
                    </div>
                    <div className={s.actions}>
                      <Badge
                        tone={
                          room.status === "available"
                            ? "success"
                            : room.status === "closed"
                              ? "danger"
                              : "warning"
                        }
                      >
                        {room.status}
                      </Badge>
                      <button
                        className={s.link}
                        aria-label={`Review ${room.code} status`}
                        onClick={() => {
                          setSelected(room.id);
                          setNext(
                            statuses.includes(room.status) ? room.status : "",
                          );
                          setFormError("");
                          requestAnimationFrame(() => panel.current?.focus());
                        }}
                      >
                        Review status →
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className={s.empty}>
                <h3>
                  {query
                    ? "No rooms match this search"
                    : data.meta.total > 0
                      ? "No rooms on this page"
                      : "No rooms published"}
                </h3>
                <p>
                  {query
                    ? "Try another code or clear your search."
                    : "Rooms appear when the campus publishes its directory."}
                </p>
              </div>
            )}
            <nav className={s.pagination} aria-label="Room pagination">
              <Button
                variant="secondary"
                disabled={state.busy || page <= 1}
                onClick={() => {
                  setSelected("");
                  setPage((p) => p - 1);
                }}
              >
                Previous
              </Button>
              <span className={s.muted}>
                {data.items.length} rooms on this page
              </span>
              <Button
                variant="secondary"
                disabled={state.busy || page >= data.meta.total_pages}
                onClick={() => {
                  setSelected("");
                  setPage((p) => p + 1);
                }}
              >
                Next page
              </Button>
            </nav>
          </section>
          <aside
            ref={panel}
            tabIndex={-1}
            className={`${s.panel} ${s.editor}`}
            aria-label="Room status workspace"
          >
            <p className={s.eyebrow}>Room status workspace</p>
            {current ? (
              <RoomEditor
                key={current.id}
                room={current}
                busy={state.busy}
                act={state.act}
                next={next}
                setNext={setNext}
                error={formError}
                setError={setFormError}
              />
            ) : (
              <div className={s.empty}>
                <WorkspaceIcon name="room" size={36} />
                <h3 className="mt-4">Choose a room to review</h3>
                <p>
                  See its current status and whether your assignment permits an
                  update.
                </p>
              </div>
            )}
            <a className={`${s.link} ${s.back}`} href="#room-results">
              Back to room list ↓
            </a>
          </aside>
        </div>
      )}
    </div>
  );
}
function RoomEditor({
  room,
  busy,
  act,
  next,
  setNext,
  error,
  setError,
}: {
  next: string;
  setNext: (value: string) => void;
  error: string;
  setError: (value: string) => void;
  room: ManagedRoom;
  busy: boolean;
  act: (action: () => Promise<void>, message: string) => Promise<void>;
}) {
  return (
    <>
      <h2>
        {room.code} · {room.name}
      </h2>
      <p className={`${s.muted} mt-3`}>
        Current published status: <strong>{room.status}</strong>
      </p>
      {room.can_update_status ? (
        <form
          className="mt-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (busy || !statuses.includes(next) || next === room.status)
              return;
            setError("");
            void act(async () => {
              try {
                const result = await staffApi.updateRoom(room.id, {
                  status: next,
                });
                if (result.room?.id !== room.id || result.room.status !== next)
                  throw new Error(
                    "The status update could not be confirmed. Review the refreshed room before retrying.",
                  );
              } catch (e) {
                setError(errorMessage(e, "Could not update room status."));
                throw e;
              }
            }, `${room.code} status confirmed: ${next}.`);
          }}
        >
          <fieldset disabled={busy}>
            <label className={s.field}>
              New room status
              <select
                required
                value={next}
                onChange={(e) => setNext(e.target.value)}
              >
                <option value="" disabled>
                  Choose a status
                </option>
                {statuses.map((value) => (
                  <option key={value} value={value}>
                    {value[0].toUpperCase() + value.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            <p className={s.muted}>
              Only the status field will change. Confirm what you observed
              before saving.
            </p>
            {error ? (
              <p className={s.error} role="alert">
                {error}
              </p>
            ) : null}
            <Button
              type="submit"
              disabled={!next || next === room.status}
              loading={busy}
            >
              Save room status
            </Button>
          </fieldset>
        </form>
      ) : (
        <p className={`${s.notice} mt-5`}>
          You can view this room, but your account is not permitted to update
          its status.
        </p>
      )}
      {room.requires_admission ? (
        <div className="mt-5">
          <p className={s.muted}>
            This room uses admission tickets. A status update does not replace
            its queue rules.
          </p>
          <Link className={`${s.link} mt-3`} href="/staff/queues">
            Browse room queues →
          </Link>
        </div>
      ) : null}
    </>
  );
}
