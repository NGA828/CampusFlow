"use client";
import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { useDebounced } from "@/lib/hooks";
import { useOperator } from "@/lib/use-operator";
import {
  campusFields,
  campusPage,
  campusBody,
  saveCampus,
  removeCampus,
  singular,
  type CampusKind,
  type CampusRow,
} from "@/lib/api/campus-admin";
import { ApiError } from "@/lib/api/client";
import { Button, Input, Select, Textarea, Modal } from "@/components/ui/kit";
import { Feedback, ReadState, Pager } from "@/components/layout/coordination";
import s from "./campus.module.css";

type Place = { id: string; name: string; code: string };
type Context = { building?: Place; floor?: Place };
type Draft = {
  kind: CampusKind;
  row?: CampusRow;
  values: Record<string, string>;
};
const txt = (v: unknown, fallback = "Not set") =>
  typeof v === "string" && v ? v : fallback;
const measure = (v: unknown, suffix = "") =>
  typeof v === "number" && Number.isFinite(v) ? `${v}${suffix}` : "Not set";
const errorText = (e: unknown) =>
  e instanceof ApiError
    ? (e.firstError ?? e.message)
    : e instanceof Error
      ? e.message
      : "The action could not be confirmed.";

export default function AdminCampusPage() {
  const [kind, setKind] = useState<CampusKind>("buildings");
  const [context, setContext] = useState<Context>({});
  const [search, setSearch] = useState("");
  const debounced = useDebounced(search, 250);
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [removal, setRemoval] = useState<CampusRow | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const locked = useRef(false);
  const scope = JSON.stringify([
    kind,
    page,
    debounced,
    context.building?.id,
    context.floor?.id,
  ]);
  const work = useOperator(
    useCallback(
      async () => ({
        ...(await campusPage(kind, {
          page,
          per_page: 12,
          q: debounced || undefined,
          building_id: kind !== "buildings" ? context.building?.id : undefined,
          floor_id: kind === "rooms" ? context.floor?.id : undefined,
        })),
        scope,
      }),
      [kind, page, debounced, context.building?.id, context.floor?.id, scope],
    ),
  );
  const ready =
    !work.loading &&
    !work.error &&
    work.data?.scope === scope &&
    search === debounced;
  const data = ready ? work.data : null;
  const canCreate =
    kind === "buildings" ||
    (kind === "floors" ? !!context.building : !!context.floor);

  function navigate(next: CampusKind, ctx = context) {
    setKind(next);
    setContext(ctx);
    setPage(1);
    setSearch("");
  }
  function explore(row: CampusRow) {
    if (row.kind === "buildings") navigate("floors", { building: row });
    if (row.kind === "floors")
      navigate("rooms", {
        building: {
          id: String(row.data.building_id),
          name: txt(row.data.building_name, "Building"),
          code: txt(row.data.building_code, ""),
        },
        floor: row,
      });
  }
  function edit(row?: CampusRow) {
    setFormError(null);
    setDraft({
      kind,
      row,
      values: row
        ? { ...row.values }
        : Object.fromEntries(
            campusFields[kind].map((f) => [f.key, f.initial ?? ""]),
          ),
    });
  }
  async function save() {
    if (!draft || locked.current) return;
    let body: Record<string, unknown>;
    try {
      body = campusBody(draft.kind, draft.values, draft.row);
      if (!Object.keys(body).length) throw new Error("No changes to save.");
      if (!draft.row && draft.kind === "floors")
        body.building_id = context.building?.id;
      if (!draft.row && draft.kind === "rooms")
        body.floor_id = context.floor?.id;
    } catch (e) {
      setFormError(errorText(e));
      return;
    }
    locked.current = true;
    setFormError(null);
    await work.act(async () => {
      try {
        await saveCampus(draft.kind, body, draft.row);
        setDraft(null);
      } catch (e) {
        setFormError(errorText(e));
        throw e;
      }
    }, "Saved record confirmed by the server.");
    locked.current = false;
  }
  async function remove() {
    if (!removal || locked.current) return;
    locked.current = true;
    setFormError(null);
    await work.act(async () => {
      try {
        await removeCampus(removal);
        setRemoval(null);
      } catch (e) {
        setFormError(errorText(e));
        throw e;
      }
    }, "Unused record removed from the active directory.");
    locked.current = false;
  }
  const groups = draft
    ? [...new Set(campusFields[draft.kind].map((f) => f.group))]
    : [];

  return (
    <div className={s.page}>
      <header className={s.header}>
        <div>
          <p className={s.eyebrow}>Campus administration / Places</p>
          <h1>Campus management</h1>
          <p>Every place, in its proper context.</p>
        </div>
        <div className={s.actions}>
          <Button
            variant="secondary"
            disabled={work.busy || work.loading}
            onClick={work.refresh}
          >
            Refresh
          </Button>
          <Button
            disabled={work.busy || !canCreate || !ready}
            onClick={() => edit()}
          >
            New {singular[kind]}
          </Button>
        </div>
      </header>
      <section
        className={s.hero}
        data-contextual={kind !== "buildings"}
        aria-label="Campus model"
      >
        <div>
          <p className={s.eyebrow}>The structure behind a campus day</p>
          <h2>
            Buildings become floors.
            <br />
            Floors become destinations.
          </h2>
          <p>
            Maintain the directory here. Configure routes, anchors and floor
            plans in the spatial workspace.
          </p>
          <Link href="/admin/spatial">
            Open spatial workspace <span aria-hidden="true">↗</span>
          </Link>
        </div>
        <div
          className={s.diagram}
          aria-label="Hierarchy illustration, not a campus map"
        >
          <div>
            <span>01</span>
            <strong>Building</strong>
          </div>
          <i aria-hidden="true" />
          <div>
            <span>02</span>
            <strong>Floor</strong>
          </div>
          <i aria-hidden="true" />
          <div>
            <span>03</span>
            <strong>Room</strong>
          </div>
          <small>One connected place hierarchy · Not a map</small>
        </div>
      </section>
      <Feedback value={work.feedback} />
      <div className={s.workspace}>
        <aside className={s.context} aria-label="Directory context">
          <p className={s.eyebrow}>Explore your campus</p>
          <h2>Place hierarchy</h2>
          <div className={s.steps}>
            {(["buildings", "floors", "rooms"] as const).map((v, i) => (
              <button
                key={v}
                type="button"
                disabled={work.busy}
                aria-label={`${v[0].toUpperCase() + v.slice(1)} directory`}
                aria-pressed={kind === v}
                onClick={() => navigate(v)}
              >
                <span>0{i + 1}</span>
                <div>
                  <strong>{v[0].toUpperCase() + v.slice(1)}</strong>
                  <small>
                    {v === "buildings"
                      ? "Campus-wide directory"
                      : v === "floors"
                        ? (context.building?.name ?? "All buildings")
                        : (context.floor?.name ??
                          context.building?.name ??
                          "All floors")}
                  </small>
                </div>
                <b aria-hidden="true">›</b>
              </button>
            ))}
          </div>
          {(context.building || context.floor) && (
            <div className={s.selected}>
              <p className={s.eyebrow}>Selected context</p>
              <p>
                {context.building?.code} · {context.building?.name}
              </p>
              {context.floor && (
                <p>
                  {context.floor.code} · {context.floor.name}
                </p>
              )}
              <Button
                variant="secondary"
                size="sm"
                disabled={work.busy}
                onClick={() => navigate(kind, {})}
              >
                Clear context
              </Button>
            </div>
          )}
          <p className={s.contextHint}>
            Open a building to browse its floors, then a floor to browse its
            rooms. Parent locations cannot be moved by this editor.
          </p>
        </aside>
        <section className={s.directory} aria-label={`${kind} directory`}>
          <div className={s.directoryHeader}>
            <div>
              <p className={s.eyebrow}>
                {kind === "buildings"
                  ? "Campus-wide"
                  : (context.floor?.name ??
                    context.building?.name ??
                    "Campus-wide")}
              </p>
              <h2>
                {kind[0].toUpperCase() + kind.slice(1)}{" "}
                <span>{data?.meta.total ?? "—"}</span>
              </h2>
            </div>
            <p>
              {data
                ? `${data.items.length} shown · ${data.meta.total} matching records`
                : "Requesting directory"}
            </p>
          </div>
          <div className={s.search}>
            <label htmlFor="campus-search">Search {kind}</label>
            <Input
              maxLength={120}
              id="campus-search"
              placeholder={
                kind === "floors" ? "Code, name or level" : "Code or name"
              }
              value={search}
              disabled={work.busy}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          {!canCreate && (
            <div className={s.guidance}>
              <p>
                Choose a {kind === "floors" ? "building" : "floor"} before
                adding a {singular[kind]}. Every record needs its correct
                parent.
              </p>
              <Button
                variant="secondary"
                size="sm"
                disabled={work.busy}
                onClick={() =>
                  navigate(kind === "floors" ? "buildings" : "floors")
                }
              >
                Browse {kind === "floors" ? "buildings" : "floors"}
              </Button>
            </div>
          )}
          <ReadState
            loading={!ready && !work.error}
            error={work.error}
            retry={work.refresh}
          />
          {data && (
            <>
              {data.items.length === 0 ? (
                <div className={s.empty}>
                  <h3>
                    {search ? "No matching places" : "No records on this page"}
                  </h3>
                  <p>
                    {search
                      ? "Try a different code or name, or clear the search."
                      : canCreate
                        ? `Add the first ${singular[kind]} in this context, or return to the first page.`
                        : "Browse the parent directory to choose where a new record belongs."}
                  </p>
                  {search ? (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setSearch("");
                        setPage(1);
                      }}
                    >
                      Clear search
                    </Button>
                  ) : (
                    page > 1 && (
                      <Button variant="secondary" onClick={() => setPage(1)}>
                        First page
                      </Button>
                    )
                  )}
                </div>
              ) : (
                <div className={kind === "floors" ? s.floorList : s.cards}>
                  {data.items.map((row) => (
                    <article key={row.id} className={s.place} data-kind={kind}>
                      <div className={s.placeHead}>
                        {kind === "floors" ? (
                          <div className={s.level}>
                            <small>Level</small>
                            <strong>{measure(row.data.level)}</strong>
                          </div>
                        ) : (
                          <div className={s.codePlate}>{row.code}</div>
                        )}
                        <div>
                          <p
                            className={s.status}
                            data-status={row.values.status}
                          >
                            {row.values.status.replaceAll("_", " ")}
                          </p>
                          <h3>{row.name}</h3>
                          <p>
                            {kind === "buildings"
                              ? txt(row.data.short_name, "Building")
                              : kind === "floors"
                                ? `${row.code} · ${txt(row.data.building_name, "Parent unavailable")}`
                                : `${txt(row.data.building_code, "Building not set")} / ${txt(row.data.floor_name, "Floor not set")}`}
                          </p>
                        </div>
                      </div>
                      {kind === "buildings" && (
                        <>
                          <p className={s.description}>
                            {txt(
                              row.data.description,
                              "A place in the campus directory. Add descriptive context in its record.",
                            )}
                          </p>
                          <dl className={s.facts}>
                            <div>
                              <dt>Floors</dt>
                              <dd>{measure(row.data.floors_count)}</dd>
                            </div>
                            <div>
                              <dt>Coordinates</dt>
                              <dd>
                                {row.data.lat === null || row.data.lng === null
                                  ? "Not set"
                                  : `${measure(row.data.lat)}, ${measure(row.data.lng)}`}
                              </dd>
                            </div>
                          </dl>
                        </>
                      )}
                      {kind === "floors" && (
                        <dl className={s.facts}>
                          <div>
                            <dt>Plan dimensions</dt>
                            <dd>
                              {row.data.plan_width_m === null ||
                              row.data.plan_height_m === null
                                ? "Not set"
                                : `${measure(row.data.plan_width_m)} × ${measure(row.data.plan_height_m)} m`}
                            </dd>
                          </div>
                          <div>
                            <dt>Rooms</dt>
                            <dd>{measure(row.data.rooms_count)}</dd>
                          </div>
                        </dl>
                      )}
                      {kind === "rooms" && (
                        <>
                          <dl className={s.facts}>
                            <div>
                              <dt>Type</dt>
                              <dd>{row.values.type}</dd>
                            </div>
                            <div>
                              <dt>Capacity</dt>
                              <dd>{row.values.capacity} people</dd>
                            </div>
                            <div>
                              <dt>Area</dt>
                              <dd>{measure(row.data.area_m2, " m²")}</dd>
                            </div>
                            <div>
                              <dt>Plan anchor</dt>
                              <dd>
                                {row.data.plan_x === null ||
                                row.data.plan_y === null
                                  ? "Not set"
                                  : `${measure(row.data.plan_x)}, ${measure(row.data.plan_y)} m`}
                              </dd>
                            </div>
                          </dl>
                          <p className={s.policy}>
                            {row.data.requires_admission
                              ? "Admission ticket required"
                              : "No admission ticket requirement"}{" "}
                            ·{" "}
                            {row.data.is_public
                              ? "Visitor-visible"
                              : "Not public"}
                          </p>
                        </>
                      )}
                      <div className={s.recordActions}>
                        {kind !== "rooms" && (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={work.busy}
                            onClick={() => explore(row)}
                          >
                            Open {kind === "buildings" ? "floors" : "rooms"}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={work.busy}
                          aria-label={`Edit ${row.code}`}
                          onClick={() => edit(row)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={work.busy}
                          aria-label={`Remove ${row.code}`}
                          onClick={() => {
                            setFormError(null);
                            setRemoval(row);
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
              <Pager
                page={data.meta.page}
                pages={data.meta.total_pages}
                total={data.meta.total}
                busy={work.busy}
                onPage={setPage}
              />
            </>
          )}
        </section>
      </div>
      <footer className={s.footer}>
        <strong>Directory metadata, not live occupancy.</strong> Admission
        policies, plan anchors and geographic coordinates are separate
        configuration.{" "}
        <Link href="/admin/services">Manage queues & offices ↗</Link>
      </footer>
      <Modal
        open={!!draft}
        onClose={() => {
          if (!locked.current) setDraft(null);
        }}
        title={`${draft?.row ? "Edit" : "New"} ${singular[draft?.kind ?? "buildings"]}`}
        footer={
          <>
            <Button
              variant="secondary"
              disabled={work.busy}
              onClick={() => setDraft(null)}
            >
              Cancel
            </Button>
            <Button type="submit" form="campus-editor" loading={work.busy}>
              Save record
            </Button>
          </>
        }
      >
        {draft && (
          <form
            id="campus-editor"
            className={s.editor}
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            {draft.kind !== "buildings" && (
              <p className={s.parentNote}>
                <strong>
                  {draft.kind === "floors" ? "Building" : "Floor"}:
                </strong>{" "}
                {draft.row
                  ? txt(
                      draft.row.data[
                        draft.kind === "floors" ? "building_name" : "floor_name"
                      ],
                      String(
                        draft.row.data[
                          draft.kind === "floors" ? "building_id" : "floor_id"
                        ],
                      ),
                    )
                  : draft.kind === "floors"
                    ? context.building?.name
                    : context.floor?.name}
                .{" "}
                {draft.row
                  ? "Parent location is fixed; it will not be changed."
                  : "This is the parent for the new record."}
              </p>
            )}
            {formError && (
              <p className={s.formError} role="alert">
                {formError}
              </p>
            )}
            {groups.map((group) => (
              <fieldset key={group} disabled={work.busy}>
                <legend>{group}</legend>
                <div className={s.fields}>
                  {campusFields[draft.kind]
                    .filter((f) => f.group === group)
                    .map((f) => (
                      <div key={f.key}>
                        <label htmlFor={"campus-" + f.key}>{f.label}</label>
                        {f.type === "select" ? (
                          <Select
                            id={"campus-" + f.key}
                            aria-describedby={
                              f.hint ? "campus-hint-" + f.key : undefined
                            }
                            value={draft.values[f.key]}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                values: {
                                  ...draft.values,
                                  [f.key]: e.target.value,
                                },
                              })
                            }
                          >
                            {[
                              ...new Set([
                                ...(f.options ?? []),
                                ...(draft.values[f.key]
                                  ? [draft.values[f.key]]
                                  : []),
                              ]),
                            ].map((o) => (
                              <option key={o} value={o}>
                                {o.replaceAll("_", " ")}
                              </option>
                            ))}
                          </Select>
                        ) : f.type === "boolean" ? (
                          <Select
                            id={"campus-" + f.key}
                            aria-describedby={
                              f.hint ? "campus-hint-" + f.key : undefined
                            }
                            value={draft.values[f.key]}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                values: {
                                  ...draft.values,
                                  [f.key]: e.target.value,
                                },
                              })
                            }
                          >
                            <option value="true">Yes</option>
                            <option value="false">No</option>
                          </Select>
                        ) : f.type === "textarea" ? (
                          <Textarea
                            id={"campus-" + f.key}
                            aria-describedby={
                              f.hint ? "campus-hint-" + f.key : undefined
                            }
                            rows={3}
                            value={draft.values[f.key]}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                values: {
                                  ...draft.values,
                                  [f.key]: e.target.value,
                                },
                              })
                            }
                          />
                        ) : (
                          <Input
                            id={"campus-" + f.key}
                            aria-describedby={
                              f.hint ? "campus-hint-" + f.key : undefined
                            }
                            type={f.type === "number" ? "number" : "text"}
                            required={f.required}
                            maxLength={f.maxLength}
                            min={f.min}
                            max={f.max}
                            step={f.step}
                            value={draft.values[f.key]}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                values: {
                                  ...draft.values,
                                  [f.key]: e.target.value,
                                },
                              })
                            }
                          />
                        )}
                        {f.hint && (
                          <p
                            className={s.fieldHint}
                            id={"campus-hint-" + f.key}
                          >
                            {f.hint}
                          </p>
                        )}
                      </div>
                    ))}
                </div>
              </fieldset>
            ))}
          </form>
        )}
      </Modal>
      <Modal
        open={!!removal}
        onClose={() => {
          if (!locked.current) setRemoval(null);
        }}
        title="Remove unused record?"
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              disabled={work.busy}
              onClick={() => setRemoval(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={work.busy}
              onClick={() => void remove()}
            >
              Remove record
            </Button>
          </>
        }
      >
        <div className={s.editor}>
          <p>
            <strong>
              {removal?.code} · {removal?.name}
            </strong>
          </p>
          <p>
            This removes an unused record from the active directory. Linked
            records, including historical references, prevent removal. Use a
            closed status for places that have been used. Child records are not
            deleted.
          </p>
          {formError && (
            <p className={s.formError} role="alert">
              {formError}
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
