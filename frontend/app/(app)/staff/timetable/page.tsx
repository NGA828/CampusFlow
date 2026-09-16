"use client";
import { useCallback, useRef, useState } from "react";
import { staffApi } from "@/lib/api/endpoints";
import type { TeachingData, TeachingEntry } from "@/lib/api/staff-services";
import { useOperator } from "@/lib/use-operator";
import { dayName } from "@/lib/hooks";
import { Badge, Button, CardSkeleton } from "@/components/ui/kit";
import { ReadError, errorMessage } from "@/components/layout/student-companion";
import s from "@/components/layout/staff-services.module.css";
const days = [1, 2, 3, 4, 5, 6, 0];
const types = ["lecture", "tutorial", "lab", "seminar"];
interface Draft {
  id?: string;
  course: string;
  term: string;
  room: string;
  day: string;
  start: string;
  end: string;
  type: string;
  title: string;
}
export default function StaffTimetablePage() {
  const [termFilter, setTermFilter] = useState("");
  const state = useOperator(
    useCallback(
      async () => ({
        ...(await staffApi.timetable(
          termFilter ? { term_code: termFilter } : {},
        )),
        requestedTerm: termFilter,
      }),
      [termFilter],
    ),
  );
  const [day, setDay] = useState("all");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [remove, setRemove] = useState<TeachingEntry | null>(null);
  const [error, setError] = useState("");
  const editor = useRef<HTMLElement>(null);
  const data = state.data?.requestedTerm === termFilter ? state.data : null;
  const open = (entry?: TeachingEntry) => {
    setError("");
    setRemove(null);
    setDraft(
      entry
        ? {
            id: entry.id,
            course: entry.course_id,
            term: entry.term,
            room: entry.room_id || "",
            day: String(entry.day),
            start: entry.start,
            end: entry.end,
            type: entry.type,
            title: `${entry.course_code} · ${entry.title}`,
          }
        : {
            course: "",
            term: data?.term || data?.terms[0]?.code || "",
            room: "",
            day: day === "all" ? "1" : day,
            start: "09:00",
            end: "10:00",
            type: "lecture",
            title: "New teaching session",
          },
    );
    requestAnimationFrame(() => editor.current?.focus());
  };
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft || state.busy || !data?.can_manage) return;
    setError("");
    if (draft.end <= draft.start) {
      setError("End time must be later than start time on the same day.");
      return;
    }
    const body = {
      room_id: draft.room || null,
      type: draft.type,
      day_of_week: Number(draft.day),
      starts_at: `${draft.start}:00`,
      ends_at: `${draft.end}:00`,
    };
    let saved = false;
    void state
      .act(
        async () => {
          try {
            const response = draft.id
              ? await staffApi.updateEntry(draft.id, body)
              : await staffApi.createEntry({
                  ...body,
                  course_id: draft.course,
                  term_code: draft.term,
                });
            const entry = response.entry;
            if (
              (draft.id && entry.id !== draft.id) ||
              entry.course_id !== draft.course ||
              entry.term !== draft.term ||
              entry.type !== draft.type ||
              entry.day !== Number(draft.day) ||
              entry.start !== draft.start ||
              entry.end !== draft.end ||
              entry.room_id !== (draft.room || null)
            )
              throw new Error(
                "The saved session did not match this draft. Review the schedule before retrying.",
              );
            saved = true;
            setDraft(null);
          } catch (e) {
            setError(errorMessage(e, "Could not save this session."));
            throw e;
          }
        },
        draft.id ? "Teaching session updated." : "Teaching session published.",
      )
      .then(() => {
        if (saved) {
          if (draft.term !== data.term) setTermFilter(draft.term);
          setDay(String(draft.day));
        }
      });
  };
  return (
    <div className={s.page}>
      <header className={s.head}>
        <div>
          <p className={s.eyebrow}>Teaching / weekly planner</p>
          <h1>Teaching timetable</h1>
          <p>
            Your published teaching pattern. Review the week, then make
            deliberate changes to individual sessions.
          </p>
        </div>
        <div className={s.actions}>
          <Button
            variant="secondary"
            disabled={state.loading || state.busy}
            onClick={state.refresh}
          >
            Refresh timetable
          </Button>
          {data?.can_manage ? (
            <Button
              disabled={state.loading || state.busy || !!draft || !!remove}
              onClick={() => open()}
            >
              Add session
            </Button>
          ) : data && !state.loading ? (
            <Badge tone="neutral">Read-only timetable</Badge>
          ) : null}
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
      ) : state.loading || !data ? (
        <CardSkeleton rows={5} />
      ) : (
        <>
          <div className={s.bar}>
            <div>
              <p className={s.eyebrow}>
                {data.terms.find((t) => t.code === data.term)?.name ||
                  data.term ||
                  "Published term"}
              </p>
              <h2>Your teaching week</h2>
            </div>
            <span className={s.muted}>
              {data.entries.length} session
              {data.entries.length === 1 ? "" : "s"} · campus wall-clock times
            </span>
          </div>
          {data.terms.length ? (
            <label className={s.field}>
              Teaching term
              <select
                value={termFilter || data.term}
                disabled={!!draft || !!remove || state.busy}
                onChange={(e) => {
                  setTermFilter(e.target.value);
                  setDay("all");
                }}
              >
                {data.terms.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.name || t.code}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className={s.tabs} aria-label="Filter teaching day">
            <button
              aria-pressed={day === "all"}
              disabled={state.busy}
              onClick={() => setDay("all")}
            >
              All days
            </button>
            {days.map((d) => (
              <button
                key={d}
                disabled={state.busy}
                aria-pressed={day === String(d)}
                onClick={() => setDay(String(d))}
              >
                {dayName(d)}
              </button>
            ))}
          </div>
          <div className={s.teaching}>
            <section
              id="teaching-schedule"
              tabIndex={-1}
              className={s.agenda}
              aria-label="Teaching sessions"
            >
              {!data.entries.some(
                (e) => day === "all" || e.day === Number(day),
              ) ? (
                <div className={`${s.panel} ${s.empty}`}>
                  <h3>No sessions in this view</h3>
                  <p>
                    {day === "all"
                      ? "No teaching sessions were returned for this term."
                      : "Choose another day or return to the full week."}
                  </p>
                </div>
              ) : (
                days
                  .filter((d) => day === "all" || String(d) === day)
                  .map((d) => {
                    const entries = data.entries
                      .filter((e) => e.day === d)
                      .sort((a, b) => a.start.localeCompare(b.start));
                    return entries.length ? (
                      <section className={s.day} key={d}>
                        <header className={s.dayTitle}>
                          <strong>{dayName(d).slice(0, 3)}</strong>
                          <span>{entries.length} sessions</span>
                        </header>
                        <div className={s.sessions}>
                          {entries.map((entry) => (
                            <article className={s.session} key={entry.id}>
                              <div className={s.bar}>
                                <time>
                                  {entry.start}–{entry.end}
                                </time>
                                <Badge tone="neutral">{entry.type}</Badge>
                              </div>
                              <h3>
                                {entry.course_code} · {entry.title}
                              </h3>
                              <p className={s.muted}>
                                {entry.room_code || "Room unassigned"}
                                {entry.building ? ` · ${entry.building}` : ""}
                              </p>
                              {data.can_manage ? (
                                <div className={s.actions}>
                                  <button
                                    className={s.link}
                                    disabled={!!draft || !!remove || state.busy}
                                    aria-label={`Edit ${entry.course_code} ${dayName(entry.day)} ${entry.start}`}
                                    onClick={() => open(entry)}
                                  >
                                    Edit session
                                  </button>
                                  <button
                                    className={s.link}
                                    disabled={!!draft || !!remove || state.busy}
                                    aria-label={`Remove ${entry.course_code} ${dayName(entry.day)} ${entry.start}`}
                                    onClick={() => {
                                      setRemove(entry);
                                      setError("");
                                      requestAnimationFrame(() =>
                                        editor.current?.focus(),
                                      );
                                    }}
                                  >
                                    Remove
                                  </button>
                                </div>
                              ) : null}
                            </article>
                          ))}
                        </div>
                      </section>
                    ) : null;
                  })
              )}
            </section>
            <aside
              ref={editor}
              tabIndex={-1}
              className={`${s.panel} ${s.editor}`}
              aria-label="Session workspace"
            >
              <p className={s.eyebrow}>
                {draft
                  ? "Session editor"
                  : remove
                    ? "Review removal"
                    : "Teaching notes"}
              </p>
              {draft ? (
                <>
                  <h2>{draft.id ? "Edit session" : "Add a session"}</h2>
                  <p className={`${s.muted} mt-3`}>{draft.title}</p>
                  <form onSubmit={save} className="mt-5">
                    <fieldset disabled={state.busy}>
                      <SessionFields
                        draft={draft}
                        setDraft={setDraft}
                        data={data}
                      />
                      {error ? (
                        <p className={s.error} role="alert">
                          {error}
                        </p>
                      ) : null}
                      <p className={s.muted}>
                        Times are in the campus schedule’s clock. Same-day
                        sessions only. The server validates the change.
                      </p>
                      <div className={s.actions}>
                        <Button
                          type="submit"
                          disabled={
                            !draft.id &&
                            (!data.courses.length || !data.terms.length)
                          }
                          loading={state.busy}
                        >
                          Save session
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => setDraft(null)}
                        >
                          Discard draft
                        </Button>
                      </div>
                    </fieldset>
                  </form>
                </>
              ) : remove ? (
                <>
                  <h2>Remove this session?</h2>
                  <p className={`${s.muted} mt-4`}>
                    {remove.course_code} · {dayName(remove.day)} ·{" "}
                    {remove.start}–{remove.end}. This removes the published
                    session, not the course.
                  </p>
                  {error ? (
                    <p className={`${s.error} mt-4`} role="alert">
                      {error}
                    </p>
                  ) : null}
                  <div className={`${s.actions} mt-5`}>
                    <Button
                      disabled={state.busy}
                      onClick={() =>
                        void state.act(async () => {
                          try {
                            await staffApi.deleteEntry(remove.id);
                            setRemove(null);
                          } catch (e) {
                            setError(
                              errorMessage(e, "Could not remove session."),
                            );
                            throw e;
                          }
                        }, "Teaching session removed.")
                      }
                    >
                      Confirm removal
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={state.busy}
                      onClick={() => setRemove(null)}
                    >
                      Keep session
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <h2>A week with room to teach.</h2>
                  <dl className={s.facts}>
                    <div>
                      <dt>One session at a time</dt>
                      <dd>
                        Review the course, day, times and room before saving.
                      </dd>
                    </div>
                    <div>
                      <dt>Course & term</dt>
                      <dd>
                        Choose these for new sessions. Existing sessions keep
                        their course and term.
                      </dd>
                    </div>
                    <div>
                      <dt>Published changes</dt>
                      <dd>
                        Changes are saved through the teaching API. This view
                        does not guarantee live delivery to other devices.
                      </dd>
                    </div>
                  </dl>
                </>
              )}
              <a className={`${s.link} ${s.back}`} href="#teaching-schedule">
                Back to teaching week ↓
              </a>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
function SessionFields({
  draft,
  setDraft,
  data,
}: {
  draft: Draft;
  setDraft: (draft: Draft) => void;
  data: TeachingData;
}) {
  const update = (key: keyof Draft, value: string) =>
    setDraft({ ...draft, [key]: value });
  return (
    <>
      {draft.id ? (
        <p className={s.notice}>
          Course and term are fixed for this entry: {draft.term}.
        </p>
      ) : (
        <>
          <label className={s.field}>
            Course
            <select
              required
              value={draft.course}
              onChange={(e) => update("course", e.target.value)}
            >
              <option value="">Choose a course</option>
              {data.courses.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.code} · {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className={s.field}>
            Term
            <select
              required
              value={draft.term}
              onChange={(e) => update("term", e.target.value)}
            >
              <option value="">Choose a term</option>
              {data.terms.map((t) => (
                <option value={t.code} key={t.code}>
                  {t.name || t.code}
                </option>
              ))}
            </select>
          </label>
          {!data.courses.length || !data.terms.length ? (
            <p className={s.notice}>
              Course or term choices are unavailable. Refresh the timetable or
              ask administration to publish them.
            </p>
          ) : null}
        </>
      )}
      <label className={s.field}>
        Day
        <select
          value={draft.day}
          onChange={(e) => update("day", e.target.value)}
        >
          {days.map((d) => (
            <option value={d} key={d}>
              {dayName(d)}
            </option>
          ))}
        </select>
      </label>
      <div className={s.two}>
        <label className={s.field}>
          Start time
          <input
            type="time"
            required
            step={60}
            value={draft.start}
            onChange={(e) => update("start", e.target.value)}
          />
        </label>
        <label className={s.field}>
          End time
          <input
            type="time"
            required
            step={60}
            value={draft.end}
            onChange={(e) => update("end", e.target.value)}
          />
        </label>
      </div>
      <label className={s.field}>
        Session type
        <select
          required
          value={draft.type}
          onChange={(e) => update("type", e.target.value)}
        >
          {!types.includes(draft.type) ? (
            <option value={draft.type}>{draft.type}</option>
          ) : null}
          {types.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <label className={s.field}>
        Room
        <select
          value={draft.room}
          onChange={(e) => update("room", e.target.value)}
        >
          <option value="">Unassigned room</option>
          {draft.room && !data.rooms.some((r) => r.id === draft.room) ? (
            <option value={draft.room}>Current room (not in catalogue)</option>
          ) : null}
          {data.rooms.map((r) => (
            <option value={r.id} key={r.id}>
              {r.code} · {r.name}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
