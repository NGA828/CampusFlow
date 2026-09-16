import type { Page } from "@playwright/test";
import { webSession } from "./web-visual-fixtures";
type Row = Record<string, unknown> & { id: string; name: string; code: string };
export const uuid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const building = (
  n: number,
  name = ["Learning centre", "Science & design", "Student services"][n - 1] ??
    `Study pavilion ${n}`,
): Row => ({
  id: uuid(n),
  code: ["A", "B", "C"][n - 1] ?? `P${n}`,
  name,
  short_name: null,
  description:
    n === 1
      ? "Teaching, independent study and shared learning spaces."
      : "A connected place in the campus directory.",
  address: null,
  status: "active",
  lat: n === 1 ? null : 3.86,
  lng: n === 1 ? null : 11.52,
  is_public: true,
  footprint: null,
  image_url: null,
  floors_count: 0,
});
const floor = (
  n: number,
  parent: number,
  code: string,
  name: string,
  level: number,
): Row => ({
  id: uuid(n),
  building_id: uuid(parent),
  code,
  name,
  level,
  status: "active",
  plan_width_m: 40,
  plan_height_m: 30,
  plan_url: null,
});
const room = (n: number, parent: number, code: string, name: string): Row => ({
  id: uuid(n),
  floor_id: uuid(parent),
  code,
  name,
  type: "lab",
  capacity: 30,
  status: "available",
  area_m2: 42,
  plan_x: 0,
  plan_y: 4.5,
  lat: null,
  lng: null,
  features: ["projector"],
  requires_admission: true,
  is_public: true,
  access_rule: { allowed_roles: ["student", "staff"] },
  image_url: null,
});
export async function campusAdminSession(page: Page, large = false) {
  await webSession(page, "admin");
  const state = {
    buildings: Array.from({ length: large ? 14 : 3 }, (_, i) =>
      building(i + 1, i === 13 ? "West annex" : undefined),
    ),
    floors: [
      floor(101, 1, "A-B", "Lower learning floor", -1),
      floor(102, 1, "A-G", "Ground learning floor", 0),
      floor(103, 1, "A-1", "First learning floor", 1),
      floor(104, 2, "B-G", "Design ground floor", 0),
      floor(114, 14, "W-G", "West ground floor", 0),
    ],
    rooms: [
      room(201, 102, "A-001", "Interaction design studio"),
      {
        ...room(202, 102, "A-002", "Quiet study room"),
        type: "study",
        requires_admission: false,
        plan_x: null,
        plan_y: null,
        area_m2: null,
      },
      room(203, 104, "B-001", "Materials laboratory"),
    ],
    reads: [] as { kind: string; query: Record<string, string> }[],
    writes: [] as {
      kind: string;
      method: string;
      body: Record<string, unknown>;
      id?: string;
    }[],
    readStatus: 200,
    writeStatus: 200,
    delayRead: 0,
    delayWrite: 0,
    readPayload: undefined as unknown,
    reply: undefined as undefined | ((row: Row) => unknown),
    deletionReply: undefined as unknown,
  };
  await page.route(
    /\/api\/v1\/admin\/(buildings|floors|rooms)(\/[^/?]+)?(\?.*)?$/,
    async (route) => {
      const url = new URL(route.request().url()),
        parts = url.pathname.split("/"),
        kind = parts[4] as "buildings" | "floors" | "rooms",
        id = parts[5],
        method = route.request().method();
      const enrich = (row: Row): Row => {
        if (kind === "buildings")
          return {
            ...row,
            floors_count: state.floors.filter((f) => f.building_id === row.id)
              .length,
          };
        const f =
            kind === "floors"
              ? row
              : state.floors.find((f) => f.id === row.floor_id),
          b = state.buildings.find((b) => b.id === f?.building_id);
        return {
          ...row,
          building_id: f?.building_id,
          building_code: b?.code ?? null,
          building_name: b?.name ?? null,
          ...(kind === "floors"
            ? {
                rooms_count: state.rooms.filter((r) => r.floor_id === row.id)
                  .length,
              }
            : { floor_name: f?.name ?? null, floor_code: f?.code ?? null }),
        };
      };
      if (method === "GET") {
        state.reads.push({ kind, query: Object.fromEntries(url.searchParams) });
        if (state.delayRead)
          await new Promise((r) => setTimeout(r, state.delayRead));
        if (state.readStatus >= 400)
          return route.fulfill({
            status: state.readStatus,
            json: {
              success: false,
              message: `Campus directory unavailable (${state.readStatus}).`,
            },
          });
        if (state.readPayload !== undefined)
          return route.fulfill({
            json: { success: true, data: state.readPayload },
          });
        const q = (url.searchParams.get("q") ?? "").toLowerCase(),
          p = Number(url.searchParams.get("page") ?? 1),
          per = Math.min(100, Number(url.searchParams.get("per_page") ?? 20));
        const list = state[kind]
          .map(enrich)
          .filter(
            (r) =>
              (!url.searchParams.get("building_id") ||
                r.building_id === url.searchParams.get("building_id")) &&
              (!url.searchParams.get("floor_id") ||
                r.floor_id === url.searchParams.get("floor_id")) &&
              (!q ||
                r.name.toLowerCase().includes(q) ||
                r.code.toLowerCase().includes(q) ||
                (kind === "floors" && String(r.level) === q)),
          );
        return route.fulfill({
          json: {
            success: true,
            data: {
              items: list.slice((p - 1) * per, p * per),
              meta: {
                current_page: p,
                per_page: per,
                total: list.length,
                last_page: Math.max(1, Math.ceil(list.length / per)),
              },
            },
          },
        });
      }
      const body = method === "DELETE" ? {} : route.request().postDataJSON();
      state.writes.push({ kind, method, body, id });
      if (state.delayWrite)
        await new Promise((r) => setTimeout(r, state.delayWrite));
      if (state.writeStatus >= 400)
        return route.fulfill({
          status: state.writeStatus,
          json: {
            success: false,
            message: `Campus write refused (${state.writeStatus}).`,
            errors: { record: ["Keep your draft and review the record."] },
          },
        });
      if (method === "DELETE") {
        state[kind] = state[kind].filter((r) => r.id !== id);
        return route.fulfill({
          json: { success: true, data: state.deletionReply ?? { deleted: id } },
        });
      }
      let row: Row;
      if (method === "POST") {
        const n = 900 + state.writes.length;
        row = {
          ...(kind === "buildings"
            ? building(n)
            : kind === "floors"
              ? floor(n, 1, "NEW", "New floor", 0)
              : room(n, 102, "NEW", "New room")),
          ...body,
          id: uuid(n),
        };
        state[kind].push(row);
      } else {
        const old = state[kind].find((r) => r.id === id)!;
        row = { ...old, ...body };
        state[kind] = state[kind].map((r) => (r.id === id ? row : r));
      }
      return route.fulfill({
        status: method === "POST" ? 201 : 200,
        json: { success: true, data: state.reply ? state.reply(row) : row },
      });
    },
  );
  return state;
}
