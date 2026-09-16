"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useAsync } from "@/lib/hooks";
import { campusApi, positioningApi } from "@/lib/api/endpoints";
import { CampusMap } from "@/components/maps/campus-map";
import { FloorPlan } from "@/components/maps/floor-plan";
import { RoutePlanner } from "@/components/maps/route-planner";
import { Badge, CardSkeleton, Button } from "@/components/ui/kit";
import { ReadError, momentLabel } from "@/components/layout/student-companion";
import type { Floor, Position, Room } from "@/lib/api/types";
import s from "@/components/layout/campus-operations.module.css";
export default function MapPage() {
  const buildings = useAsync(() => campusApi.buildings(), []);
  const position = useAsync(() => positioningApi.current(), []);
  const [buildingId, setBuildingId] = useState("");
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"campus" | "indoor">("campus");
  const rows = buildings.data?.buildings ?? [];
  const selected = rows.find((b) => b.id === buildingId) ?? rows[0];
  const fix =
    position.error || position.loading ? null : position.data?.position;
  const choices = rows.filter((b) =>
    `${b.name} ${b.code}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className={s.page}>
      <header className={s.heading}>
        <div>
          <p className={s.eyebrow}>Campus explorer / find your place</p>
          <h1>Campus map</h1>
          <p>
            From a building to a room. Explore the published campus map, then
            preview your route.
          </p>
        </div>
        <a className={`${s.link} ${s.primary}`} href="#route-preview">
          Plan a route →
        </a>
      </header>
      {position.loading ? (
        <p className={s.notice} role="status">
          Loading saved position…
        </p>
      ) : position.error ? (
        <div className={s.error}>
          <p>
            Saved position unavailable. You can still explore and choose a route
            starting anchor.
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
              · {momentLabel(fix.updated_at)}. This is a saved fix, not live
              location.
            </>
          ) : (
            <>
              No saved position. Choose a building to explore; use your phone
              for live positioning.
            </>
          )}
        </p>
      )}
      {buildings.error ? (
        <ReadError message={buildings.error} retry={buildings.reload} />
      ) : buildings.loading ? (
        <CardSkeleton rows={7} />
      ) : !rows.length ? (
        <section className={`${s.panel} ${s.empty}`}>
          <h2>No campus buildings published</h2>
          <p>Maps and indoor plans appear when your campus publishes them.</p>
        </section>
      ) : (
        <div className={s.explorer}>
          <aside className={s.places}>
            <div>
              <p className={s.eyebrow}>Explore by building</p>
              <h2>Places on campus</h2>
            </div>
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
                  Schematic map from campus data. Select a building on the map
                  or in the list. Saved positions may no longer reflect where
                  you are.
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
      <Suspense fallback={<CardSkeleton rows={3} />}>
        <RoutePlanner />
      </Suspense>
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
