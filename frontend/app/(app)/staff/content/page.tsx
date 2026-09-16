"use client";
import { useCallback, useRef, useState } from "react";
import { campusApi, staffApi } from "@/lib/api/endpoints";
import {
  publication,
  pageMeta,
  rows,
  record,
  invalidWorkspace,
  type Publication,
} from "@/lib/api/coordination";
import { useOperator } from "@/lib/use-operator";
import { statusLabel } from "@/lib/hooks";
import { Button, ConfirmDialog } from "@/components/ui/kit";
import {
  CoordinationHeader,
  ReadState,
  Empty,
  Feedback,
  Pager,
} from "@/components/layout/coordination";
import s from "@/components/layout/coordination.module.css";
type Kind = "event" | "notice";
type Draft = {
  id: string;
  title: string;
  body: string;
  category: string;
  priority: string;
  starts: string;
  ends: string;
  venue: string;
  capacity: string;
  audience: string;
};
function displayDate(
  value: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleString(undefined, options)
    : "—";
}
function localDate(v: string) {
  if (!v) return "";
  const d = new Date(v);
  if (!Number.isFinite(d.getTime())) return "";
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export default function StaffContentPage() {
  const [kind, setKind] = useState<Kind>("event"),
    [page, setPage] = useState(1),
    [search, setSearch] = useState("");
  const state = useOperator(
    useCallback(async () => {
      if (kind === "event") {
        const v = record(await campusApi.events({ page, per_page: 12 }));
        return {
          kind,
          page,
          items: rows(v.items).map((v) => publication(v, "event")),
          meta: pageMeta(v.meta),
        };
      }
      const v = await staffApi.announcements();
      return {
        kind,
        page,
        items: rows(v.announcements).map((v) => publication(v, "notice")),
        meta: null,
      };
    }, [kind, page]),
  );
  const [draft, setDraft] = useState<Draft | null>(null),
    [remove, setRemove] = useState<Publication | null>(null),
    [error, setError] = useState<string | null>(null);
  const editor = useRef<HTMLElement>(null);
  const data =
    state.data?.kind === kind && state.data.page === page ? state.data : null;
  const focus = () => requestAnimationFrame(() => editor.current?.focus());
  const begin = (item?: Publication) => {
    setError(null);
    setDraft(
      item
        ? {
            id: item.id,
            title: item.title,
            body: item.body,
            category: item.category,
            priority: item.priority,
            starts: localDate(item.starts_at),
            ends: localDate(item.ends_at),
            venue: item.venue,
            capacity: item.capacity === null ? "" : String(item.capacity),
            audience: item.target_roles[0] || "all",
          }
        : {
            id: "",
            title: "",
            body: "",
            category: "academic",
            priority: "normal",
            starts: "",
            ends: "",
            venue: "",
            capacity: "",
            audience: "all",
          },
    );
    focus();
  };
  const save = () => {
    if (!draft) return;
    setError(null);
    if (!draft.title.trim() || (kind === "notice" && !draft.body.trim())) {
      setError("Add a title and the required publication text.");
      return;
    }
    if (
      kind === "event" &&
      (!draft.starts ||
        !Number.isFinite(new Date(draft.starts).getTime()) ||
        (draft.ends && new Date(draft.ends) <= new Date(draft.starts)))
    ) {
      setError("Choose a valid start and an end later than the start.");
      return;
    }
    if (
      kind === "event" &&
      draft.capacity &&
      (!Number.isInteger(Number(draft.capacity)) || Number(draft.capacity) < 1)
    ) {
      setError("Capacity must be a positive whole number.");
      return;
    }
    void state
      .act(
        async () => {
          if (kind === "event") {
            const payload = {
              title: draft.title.trim(),
              description: draft.body || null,
              category: draft.category,
              starts_at: new Date(draft.starts).toISOString(),
              ends_at: draft.ends ? new Date(draft.ends).toISOString() : null,
              venue: draft.venue || null,
              capacity: draft.capacity ? Number(draft.capacity) : null,
            };
            const result = draft.id
              ? await staffApi.updateEvent(draft.id, payload)
              : await staffApi.createEvent(payload);
            const saved = publication(result.event, "event");
            if (
              (draft.id && saved.id !== draft.id) ||
              saved.title !== payload.title ||
              saved.body !== draft.body ||
              new Date(saved.starts_at).getTime() !==
                new Date(payload.starts_at).getTime() ||
              saved.capacity !== payload.capacity ||
              saved.venue !== (payload.venue || "") ||
              saved.category !== payload.category ||
              (saved.ends_at ? new Date(saved.ends_at).getTime() : null) !==
                (payload.ends_at
                  ? new Date(payload.ends_at).getTime()
                  : null) ||
              record(result.event).status !== "published"
            )
              throw invalidWorkspace();
          } else {
            const result = await staffApi.createAnnouncement({
              title: draft.title.trim(),
              body: draft.body,
              priority: draft.priority,
              target_roles: draft.audience === "all" ? null : [draft.audience],
            });
            const saved = publication(result.announcement, "notice");
            if (
              saved.title !== draft.title.trim() ||
              saved.body !== draft.body ||
              saved.priority !== draft.priority ||
              saved.target_roles[0] !== draft.audience ||
              !Number.isFinite(new Date(saved.published_at).getTime())
            )
              throw invalidWorkspace();
          }
          setDraft(null);
        },
        draft.id
          ? "Event changes confirmed."
          : `Publication confirmed. ${draft.title.trim()}${kind === "event" ? " may appear on another page of the chronological event list." : " is now in your announcement ledger."}`,
      )
      .then(() => {
        if (editor.current) focus();
      });
  };
  const changeKind = (next: Kind) => {
    setKind(next);
    setPage(1);
    setSearch("");
  };
  const list =
    data?.items.filter((i) =>
      `${i.title} ${i.body} ${i.venue}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    ) || [];
  return (
    <div className={s.page}>
      <CoordinationHeader
        eyebrow="Staff / editorial workspace"
        title="Events & announcements"
        description="Give campus a clear message. Review published events or write a notice for the right audience."
      >
        <Button
          variant="secondary"
          disabled={state.busy || state.loading}
          onClick={state.refresh}
        >
          Refresh publications
        </Button>
        <Button
          disabled={!!draft || !!remove || state.busy}
          onClick={() => begin()}
        >
          {kind === "event" ? "New event" : "New announcement"}
        </Button>
      </CoordinationHeader>
      <Feedback value={state.feedback} />
      <div className={s.tabs} aria-label="Publication kind">
        <button
          aria-pressed={kind === "event"}
          disabled={!!draft || !!remove || state.busy}
          onClick={() => changeKind("event")}
        >
          Events
        </button>
        <button
          aria-pressed={kind === "notice"}
          disabled={!!draft || !!remove || state.busy}
          onClick={() => changeKind("notice")}
        >
          Announcements
        </button>
      </div>
      <div className={s.split}>
        <section className={s.panel} id="publication-list" tabIndex={-1}>
          <div className={s.panelHead}>
            <div>
              <p className={s.eyebrow}>
                {kind === "event"
                  ? "Campus programme"
                  : "Your published notices"}
              </p>
              <h2>
                {kind === "event" ? "Published events" : "Announcement ledger"}
              </h2>
            </div>
            <span className={s.muted}>
              {data?.meta
                ? `${data.meta.total} events in the server list`
                : data
                  ? `${data.items.length} notices returned`
                  : ""}
            </span>
          </div>
          <p className={s.scopeNote}>
            {kind === "event"
              ? "The campus list includes other authors. Only events with a server-confirmed management capability offer editing or removal."
              : "This ledger contains announcements authored by you. Audience targeting uses the server’s role list; delivery is not a real-time guarantee."}
          </p>
          <label className={`${s.field} ${s.back}`}>
            Find in loaded publications
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Title, message or venue"
            />
          </label>
          <ReadState
            loading={state.loading || (!data && !state.error)}
            error={state.error}
            retry={state.refresh}
          />
          {!state.loading && !state.error && data ? (
            <>
              {list.length ? (
                <ul>
                  {list.map((item) => (
                    <li className={s.publication} key={item.id}>
                      <div className={s.date} aria-hidden="true">
                        {kind === "event" ? (
                          <>
                            <span>
                              {displayDate(item.starts_at, { month: "short" })}
                            </span>
                            <strong>
                              {displayDate(item.starts_at, { day: "numeric" })}
                            </strong>
                          </>
                        ) : (
                          <strong>¶</strong>
                        )}
                      </div>
                      <div>
                        <h3>{item.title}</h3>
                        <p>
                          {kind === "event"
                            ? `${displayDate(item.starts_at, { dateStyle: "medium", timeStyle: "short" })} · ${item.venue || "Venue not specified"}`
                            : `${statusLabel(item.priority)} priority · ${item.target_roles.join(", ")}`}
                        </p>
                        <p>{item.body || "No description supplied."}</p>
                        <span className={s.pill}>
                          {kind === "event"
                            ? `${item.category || "Event"} · ${item.capacity === null ? "No capacity supplied" : `${item.capacity} places`}`
                            : `Published ${displayDate(item.published_at)}`}
                        </span>
                      </div>
                      <div className={s.actions}>
                        {item.can_manage ? (
                          <>
                            {kind === "event" ? (
                              <Button
                                variant="secondary"
                                size="sm"
                                disabled={!!draft || state.busy}
                                onClick={() => begin(item)}
                                aria-label={`Edit ${item.title}`}
                              >
                                Edit
                              </Button>
                            ) : null}
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={!!draft || state.busy}
                              onClick={() => setRemove(item)}
                              aria-label={`Remove ${item.title}`}
                            >
                              Remove
                            </Button>
                          </>
                        ) : (
                          <span className={s.muted}>View only</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty
                  title={
                    search
                      ? "No loaded publications match"
                      : kind === "event"
                        ? "No events on this page"
                        : "No announcements yet"
                  }
                >
                  {search
                    ? "Try another search of this page."
                    : "Create a publication, or review another page if available."}
                </Empty>
              )}
              {data.meta ? (
                <Pager
                  page={data.meta.page}
                  pages={data.meta.total_pages}
                  total={data.meta.total}
                  busy={state.busy || !!draft || !!remove}
                  onPage={(p) => {
                    setPage(p);
                    setSearch("");
                  }}
                />
              ) : null}
            </>
          ) : null}
        </section>
        <aside
          className={`${s.panel} ${s.editor}`}
          ref={editor}
          tabIndex={-1}
          aria-label="Publication workspace"
          data-active={!!draft}
        >
          <p className={s.eyebrow}>
            {draft ? "Compose & review" : "Before you publish"}
          </p>
          <h2>
            {draft
              ? draft.id
                ? "Edit event"
                : kind === "event"
                  ? "Create an event"
                  : "Write an announcement"
              : "Make the next step clear."}
          </h2>
          {draft ? (
            <form
              className={s.form}
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
            >
              <fieldset disabled={state.busy} className={s.form}>
                <label className={s.field}>
                  Title
                  <input
                    required
                    maxLength={255}
                    value={draft.title}
                    onChange={(e) =>
                      setDraft({ ...draft, title: e.target.value })
                    }
                  />
                </label>
                <label className={s.field}>
                  {kind === "event" ? "Description" : "Message"}
                  <textarea
                    required={kind === "notice"}
                    value={draft.body}
                    onChange={(e) =>
                      setDraft({ ...draft, body: e.target.value })
                    }
                  />
                </label>
                {kind === "event" ? (
                  <>
                    <label className={s.field}>
                      Category
                      <select
                        value={draft.category}
                        onChange={(e) =>
                          setDraft({ ...draft, category: e.target.value })
                        }
                      >
                        {[
                          ...new Set(
                            [
                              "academic",
                              "career",
                              "social",
                              "sport",
                              "wellbeing",
                              "administrative",
                              draft.category,
                            ].filter(Boolean),
                          ),
                        ].map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </label>
                    <label className={s.field}>
                      Start time
                      <input
                        required
                        type="datetime-local"
                        value={draft.starts}
                        onChange={(e) =>
                          setDraft({ ...draft, starts: e.target.value })
                        }
                      />
                    </label>
                    <label className={s.field}>
                      End time (optional)
                      <input
                        type="datetime-local"
                        value={draft.ends}
                        onChange={(e) =>
                          setDraft({ ...draft, ends: e.target.value })
                        }
                      />
                    </label>
                    <p className={s.muted}>
                      Enter times in your device’s local timezone. They are
                      converted to an absolute timestamp for the server.
                    </p>
                    <label className={s.field}>
                      Venue
                      <input
                        maxLength={255}
                        value={draft.venue}
                        onChange={(e) =>
                          setDraft({ ...draft, venue: e.target.value })
                        }
                      />
                    </label>
                    <label className={s.field}>
                      Capacity (optional)
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={draft.capacity}
                        onChange={(e) =>
                          setDraft({ ...draft, capacity: e.target.value })
                        }
                      />
                    </label>
                  </>
                ) : (
                  <>
                    <label className={s.field}>
                      Priority
                      <select
                        value={draft.priority}
                        onChange={(e) =>
                          setDraft({ ...draft, priority: e.target.value })
                        }
                      >
                        {["low", "normal", "high", "urgent"].map((p) => (
                          <option key={p}>{p}</option>
                        ))}
                      </select>
                    </label>
                    <label className={s.field}>
                      Audience
                      <select
                        value={draft.audience}
                        onChange={(e) =>
                          setDraft({ ...draft, audience: e.target.value })
                        }
                      >
                        {["all", "student", "staff", "admin", "visitor"].map(
                          (p) => (
                            <option key={p} value={p}>
                              {p === "all" ? "Whole campus" : p}
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                  </>
                )}
                {error ? (
                  <p role="alert" className={s.danger}>
                    {error}
                  </p>
                ) : null}
                <p className={s.scopeNote}>
                  Saving publishes immediately. Review the title, text and{" "}
                  {kind === "event" ? "time and venue" : "audience"} first. No
                  notification delivery guarantee is implied.
                </p>
                <div className={s.actions}>
                  <Button type="submit" loading={state.busy}>
                    {draft.id ? "Save event changes" : "Publish"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setDraft(null);
                      setError(null);
                    }}
                  >
                    Discard draft
                  </Button>
                </div>
              </fieldset>
            </form>
          ) : (
            <>
              <p className={`${s.muted} ${s.back}`}>
                A useful campus message says what is happening, who it affects
                and what to do next.
              </p>
              <div className={`${s.scopeNote} ${s.back}`}>
                <strong>Events</strong>
                <p>
                  Use a clear venue and timing. Capacity is optional, but must
                  be a positive whole number when supplied.
                </p>
              </div>
              <div className={`${s.scopeNote} ${s.back}`}>
                <strong>Announcements</strong>
                <p>
                  Use priority deliberately. Audience targeting controls
                  visibility, not a promise of delivery.
                </p>
              </div>
            </>
          )}
          <a className={`${s.link} ${s.back}`} href="#publication-list">
            Back to publication list ↓
          </a>
        </aside>
      </div>
      <ConfirmDialog
        open={!!remove}
        title="Remove this publication?"
        message={
          remove
            ? `${remove.title} will be removed from its published list. Existing records follow the server’s retention rules. ${state.feedback?.error ? state.feedback.text : ""}`
            : ""
        }
        loading={state.busy}
        confirmLabel="Confirm removal"
        onCancel={() => {
          if (!state.busy) setRemove(null);
        }}
        onConfirm={() => {
          if (!remove) return;
          void state.act(async () => {
            if (kind === "event") await staffApi.deleteEvent(remove.id);
            else await staffApi.deleteAnnouncement(remove.id);
            setRemove(null);
          }, "Publication removal confirmed.");
        }}
      />
    </div>
  );
}
