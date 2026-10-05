"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAsync } from "@/lib/hooks";
import { campusApi, positioningApi } from "@/lib/api/endpoints";
import { CampusMap } from "@/components/maps/campus-map";
import { FloorPlan } from "@/components/maps/floor-plan";
import { RoutePlanner } from "@/components/maps/route-planner";
import { RoutePreview } from "@/components/maps/route-preview";
import { UniversityDirectory } from "@/components/maps/university-directory";
import { Badge, CardSkeleton, Button } from "@/components/ui/kit";
import { ReadError, momentLabel } from "@/components/layout/student-companion";
import type { Floor, Position, Room, Route, University } from "@/lib/api/types";
import type { RouteStartFix } from "@/lib/maps/route-geometry";
import s from "@/components/layout/campus-operations.module.css";

export default function MapPage() {
  return <Suspense fallback={<CardSkeleton rows={7} />}><MapContent /></Suspense>;
}
function MapContent() {
  const params = useSearchParams();
  const buildings = useAsync(() => campusApi.buildings(), []);
  // Every institution in Yaoundé, not just the one this deployment operates.
  const universities = useAsync(() => campusApi.universities(), []);
  const position = useAsync(() => positioningApi.current(), []);
  const [buildingId, setBuildingId] = useState("");
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"campus" | "indoor">("campus");
  const [activeRoute, setActiveRoute] = useState<Route | null>(null);
  const [activeRouteOriginFix, setActiveRouteOriginFix] = useState<RouteStartFix | null>(null);
  const [leftTab, setLeftTab] = useState<"places" | "route" | "institutions">(params.has("route") ? "route" : "places");
  const [focusedUniversity, setFocusedUniversity] = useState<University | null>(null);

  const rows = buildings.data?.buildings ?? [];
  const selected = rows.find((b) => b.id === buildingId) ?? rows[0];
  const fix = position.error || position.loading ? null : position.data?.position;
  const choices = rows.filter((b) =>
    `${b.name} ${b.code}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className={s.page}>
      <header className={s.heading}>
        <div>
          <p className={s.eyebrow}>Campus explorer & route guidance</p>
          <h1>Campus map</h1>
          <p>
            From a building to a room. Explore published places or preview your route on the master interactive map.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { setLeftTab("places"); setActiveRoute(null); setActiveRouteOriginFix(null); }}
            className={`rounded-[12px] px-3.5 py-2 text-[13px] font-bold transition-all ${leftTab === "places" && !activeRoute ? "bg-brand-600 text-white shadow-sm" : "bg-white border border-ink-200 text-ink-700 hover:bg-ink-50"}`}
          >
            Explore Places
          </button>
          <button
            type="button"
            onClick={() => { setLeftTab("route"); setActiveRoute(null); setActiveRouteOriginFix(null); }}
            className={`rounded-[12px] px-3.5 py-2 text-[13px] font-bold transition-all ${leftTab === "route" || activeRoute ? "bg-brand-600 text-white shadow-sm" : "bg-white border border-ink-200 text-ink-700 hover:bg-ink-50"}`}
          >
            Plan Route →
          </button>
        </div>
      </header>

      {position.loading ? (
        <p className={s.notice} role="status">
          Loading saved position…
        </p>
      ) : position.error ? (
        <div className={s.error}>
          <p>
            Saved position unavailable. You can still explore and choose a route starting anchor.
          </p>
          <Button variant="secondary" onClick={position.reload}>
            Retry saved position
          </Button>
        </div>
      ) : (
        <p className={s.notice}>
          {fix ? (
            <>
              Saved position:{" "}
              <strong>
                {fix.building_name || fix.building_code || "Campus location"}
              </strong>{" "}
              · {momentLabel(fix.updated_at)}. Saved fix, not live location.
            </>
          ) : (
            <>
              No saved position. Choose a building or plan a route; use mobile app for live positioning.
            </>
          )}
        </p>
      )}

      {buildings.error ? (
        <ReadError message={buildings.error} retry={buildings.reload} />
      ) : buildings.loading ? (
        <div>
          <p className={s.notice} role="status" aria-live="polite">
            Loading published campus map…
          </p>
          <CardSkeleton rows={7} />
        </div>
      ) : !rows.length ? (
        <section className={`${s.panel} ${s.empty}`}>
          <h2>No campus buildings published</h2>
          <p>Maps and indoor plans appear when your campus publishes them.</p>
        </section>
      ) : activeRoute ? (
        /* Unified Master Map View when a Route is Active */
        <div className="space-y-4">
          <RoutePreview
            route={activeRoute}
            walking={null}
            startFix={activeRouteOriginFix}
            onClearRoute={() => { setActiveRoute(null); setActiveRouteOriginFix(null); }}
          />
        </div>
      ) : (
        /* Unified Explorer View */
        <div className={s.explorer}>
          <aside className={s.places}>
            <div className="flex items-center justify-between border-b border-ink-100 pb-2.5">
              <div>
                <p className={s.eyebrow}>{leftTab === "places" ? "Browse buildings" : leftTab === "institutions" ? "Yaoundé" : "Wayfinding"}</p>
                <h2>{leftTab === "places" ? "Places on campus" : leftTab === "institutions" ? "Institutions" : "Plan a route"}</h2>
              </div>
              <div className="flex rounded-lg bg-ink-100 p-0.5 text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setLeftTab("places")}
                  className={`rounded-md px-2 py-1 transition-colors ${leftTab === "places" ? "bg-white text-ink-900 shadow-xs" : "text-ink-500"}`}
                >
                  Places
                </button>
                <button
                  type="button"
                  onClick={() => setLeftTab("route")}
                  className={`rounded-md px-2 py-1 transition-colors ${leftTab === "route" ? "bg-white text-ink-900 shadow-xs" : "text-ink-500"}`}
                >
                  Route
                </button>
                <button
                  type="button"
                  onClick={() => setLeftTab("institutions")}
                  className={`rounded-md px-2 py-1 transition-colors ${leftTab === "institutions" ? "bg-white text-ink-900 shadow-xs" : "text-ink-500"}`}
                >
                  Institutions
                </button>
              </div>
            </div>

            {leftTab === "institutions" ? (
              universities.loading ? (
                <CardSkeleton rows={5} />
              ) : universities.error ? (
                <ReadError message={universities.error} retry={universities.reload} />
              ) : (
                <UniversityDirectory
                  universities={universities.data?.universities ?? []}
                  attribution={universities.data?.attribution}
                  selectedCode={focusedUniversity?.code ?? null}
                  onSelect={setFocusedUniversity}
                />
              )
            ) : leftTab === "places" ? (
              <>
                <div className={s.tools}>
                  <label>
                    Find a building
                    <input
                      type="search"
                      placeholder="Name or code"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                </div>
                <p className={s.muted}>
                  {choices.length} of {rows.length} buildings
                </p>
                <div className={s.placeList} aria-label="Campus buildings">
                  {choices.map((b) => (
                    <button
                      key={b.id}
                      aria-pressed={b.id === selected?.id}
                      onClick={() => setBuildingId(b.id)}
                    >
                      <strong>
                        {b.code} · {b.name}
                      </strong>
                      {b.status}
                    </button>
                  ))}
                </div>
                {!choices.length ? (
                  <div className={s.empty}>
                    <h3>No matching buildings</h3>
                    <button className={s.link} onClick={() => setSearch("")}>
                      Clear search
                    </button>
                  </div>
                ) : null}
                <Link className={s.link} href="/student/campus/rooms">
                  Browse all rooms →
                </Link>
              </>
            ) : (
              <div className="pt-1">
                <Suspense fallback={<CardSkeleton rows={3} />}>
                  <RoutePlanner
                    hidePreviewCard
                    onRouteCalculated={(r, startFix) => {
                      setActiveRoute(r);
                      setActiveRouteOriginFix(startFix);
                    }}
                  />
                </Suspense>
              </div>
            )}
          </aside>

          <section className={s.map}>
            <div className={s.bar}>
              <div>
                <p className={s.eyebrow}>
                  {selected?.code} / selected building
                </p>
                <h2>{selected?.name}</h2>
              </div>
              <div className={s.actions} aria-label="Map view">
                <button
                  className={`${s.link} ${mode === "campus" ? s.primary : ""}`}
                  aria-pressed={mode === "campus"}
                  onClick={() => setMode("campus")}
                >
                  Campus
                </button>
                <button
                  className={`${s.link} ${mode === "indoor" ? s.primary : ""}`}
                  aria-pressed={mode === "indoor"}
                  onClick={() => setMode("indoor")}
                >
                  Indoor
                </button>
              </div>
            </div>
            {mode === "campus" ? (
              <>
                <CampusMap
                  buildings={rows}
                  selectedBuildingId={selected?.id}
                  onSelectBuilding={setBuildingId}
                  onOpenBuilding={() => setMode("indoor")}
                  height={410}
                  markers={
                    fix &&
                    typeof fix.lat === "number" &&
                    typeof fix.lng === "number" &&
                    Number.isFinite(fix.lat) &&
                    Number.isFinite(fix.lng)
                      ? [
                          {
                            lat: fix.lat,
                            lng: fix.lng,
                            label: "Saved position",
                            tone: "user",
                          },
                        ]
                      : []
                  }
                />
                <p className={s.mapNote}>
                  3D campus map with mapped buildings. Select a building on the map or in the list.
                </p>
                <div className={`${s.bar} mt-5`}>
                  <p className={s.muted}>
                    Ready to look inside {selected?.code}?
                  </p>
                  <Button variant="secondary" onClick={() => setMode("indoor")}>
                    Explore floors & rooms
                  </Button>
                </div>
              </>
            ) : selected ? (
              <BuildingInterior
                key={selected.id}
                id={selected.id}
                position={fix ?? null}
              />
            ) : null}
          </section>
        </div>
      )}
    </div>
  );
}
function BuildingInterior({
  id,
  position,
}: {
  id: string;
  position: Position | null;
}) {
  const building = useAsync(() => campusApi.building(id), [id]);
  const [floorId, setFloorId] = useState("");
  const floors = building.data?.floors ?? [];
  const floor = floors.find((f) => f.id === floorId) ?? floors[0];
  if (building.error)
    return <ReadError message={building.error} retry={building.reload} />;
  if (building.loading) return <CardSkeleton rows={4} />;
  if (!floor)
    return (
      <div className={s.empty}>
        <h3>No indoor floors published</h3>
        <p>Use the campus overview or browse the room directory.</p>
      </div>
    );
  return (
    <>
      <div className={s.tools}>
        <label>
          Floor
          <select value={floor.id} onChange={(e) => setFloorId(e.target.value)}>
            {floors.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <FloorInterior key={floor.id} floor={floor} position={position} />
    </>
  );
}
function FloorInterior({
  floor,
  position,
}: {
  floor: Floor;
  position: Position | null;
}) {
  const plan = useAsync(() => campusApi.floorPlan(floor.id), [floor.id]);
  const [room, setRoom] = useState<Room | null>(null);
  if (plan.error) return <ReadError message={plan.error} retry={plan.reload} />;
  if (plan.loading || !plan.data) return <CardSkeleton rows={4} />;
  if (plan.data.floor.id !== floor.id)
    return (
      <ReadError
        message="The service returned a different floor. Reload this plan before selecting a room."
        retry={plan.reload}
      />
    );
  const rooms = plan.data.rooms;
  const busy = Object.keys(plan.data.busy);
  return (
    <>
      <div className="mt-4">
        <FloorPlan
          plan={plan.data}
          selectedRoomId={room?.id}
          onSelectRoom={setRoom}
          busyRoomIds={busy}
          marker={
            position?.floor_id === floor.id &&
            typeof position.plan_x === "number" &&
            typeof position.plan_y === "number"
              ? {
                  x: position.plan_x,
                  y: position.plan_y,
                  label: "Saved position",
                }
              : null
          }
        />
      </div>
      <p className={s.mapNote}>
        Published room locations. Dots mark positions where no room outline is
        provided. This is not walking guidance; room status does not guarantee a
        seat.
      </p>
      {room ? (
        <section className={s.roomSelected} aria-label="Selected room">
          <div>
            <p className={s.eyebrow}>{floor.name} / room selected</p>
            <h3>
              {room.code} · {room.name}
            </h3>
            <p className={s.muted}>
              {room.room_type} · {room.capacity} capacity
            </p>
            <Badge tone="neutral">{room.status}</Badge>
          </div>
          <div className={s.actions}>
            <Link
              className={s.link}
              href={`/student/campus/rooms/${encodeURIComponent(room.code)}`}
            >
              Room details →
            </Link>
            <Link
              className={`${s.link} ${s.primary}`}
              href={`/student/campus/map?route=${encodeURIComponent(room.code)}#route-preview`}
            >
              Preview route
            </Link>
          </div>
        </section>
      ) : null}
      <div className={`${s.bar} mt-6`}>
        <h3>Rooms on this floor</h3>
        <span className={s.muted}>{rooms.length} published</span>
      </div>
      {rooms.length ? (
        <div className={s.roomGrid}>
          {rooms.map((r) => (
            <button
              key={r.id}
              aria-label={`${r.code} · ${r.name} · ${r.status}`}
              aria-pressed={room?.id === r.id}
              onClick={() => setRoom(r)}
            >
              <strong>{r.code}</strong>
              {r.name}
              <br />
              {r.status}
            </button>
          ))}
        </div>
      ) : (
        <div className={s.empty}>
          <h3>No rooms on this plan yet</h3>
          <p>Try another floor or browse the room directory.</p>
        </div>
      )}
    </>
  );
}
