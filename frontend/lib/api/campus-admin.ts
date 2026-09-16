import { adminApi } from "./endpoints";
import { ApiError } from "./client";
import { identity, record, rows, pageMeta } from "./coordination";
import type { ListQuery } from "./endpoints";
export type CampusKind = "buildings" | "floors" | "rooms";
export const singular = {
  buildings: "building",
  floors: "floor",
  rooms: "room",
};
export interface CampusField {
  key: string;
  label: string;
  group: string;
  type?: "number" | "select" | "boolean" | "textarea";
  required?: boolean;
  maxLength?: number;
  min?: number;
  max?: number;
  step?: string;
  options?: string[];
  initial?: string;
  hint?: string;
}
const name = (maxLength: number): CampusField => ({
  key: "name",
  label: "Name",
  group: "Identity",
  required: true,
  maxLength,
});
const code = (maxLength: number): CampusField => ({
  key: "code",
  label: "Code",
  group: "Identity",
  required: true,
  maxLength,
});
const status = (options: string[]): CampusField => ({
  key: "status",
  label: "Status",
  group: "Identity",
  type: "select",
  options,
  initial: options[0],
});
const coordinates: CampusField[] = [
  {
    key: "lat",
    label: "Latitude",
    group: "Coordinates",
    type: "number",
    min: -90,
    max: 90,
    step: "0.0000001",
    hint: "Optional geographic metadata; blank remains unset, not zero.",
  },
  {
    key: "lng",
    label: "Longitude",
    group: "Coordinates",
    type: "number",
    min: -180,
    max: 180,
    step: "0.0000001",
  },
];
const visibility: CampusField = {
  key: "is_public",
  label: "Visible to visitors",
  type: "boolean",
  group: "Visibility & admission",
  initial: "true",
  hint: "Public visibility is separate from permission to enter.",
};
export const campusFields: Record<CampusKind, CampusField[]> = {
  buildings: [
    code(20),
    name(120),
    status([
      "active",
      "operational",
      "limited",
      "under_maintenance",
      "maintenance",
      "closed",
    ]),
    {
      key: "short_name",
      label: "Short name",
      group: "Identity",
      maxLength: 40,
    },
    { key: "address", label: "Address", group: "Identity", maxLength: 200 },
    {
      key: "description",
      label: "Description",
      type: "textarea",
      group: "Identity",
    },
    ...coordinates,
    visibility,
  ],
  floors: [
    code(20),
    name(80),
    {
      key: "level",
      label: "Level",
      type: "number",
      group: "Identity",
      required: true,
      initial: "0",
      step: "1",
      min: -2147483648,
      max: 2147483647,
      hint: "Ground = 0. Use negative numbers for basements.",
    },
    status(["active", "operational", "maintenance", "closed"]),
    {
      key: "plan_width_m",
      label: "Plan width (m)",
      type: "number",
      group: "Plan dimensions",
      min: 0.01,
      max: 999999.99,
      step: ".01",
    },
    {
      key: "plan_height_m",
      label: "Plan height (m)",
      type: "number",
      group: "Plan dimensions",
      min: 0.01,
      max: 999999.99,
      step: ".01",
      hint: "Dimensions are metadata, not a generated plan or navigation graph.",
    },
  ],
  rooms: [
    code(30),
    name(120),
    {
      key: "type",
      label: "Room type",
      group: "Identity",
      type: "select",
      initial: "classroom",
      options: [
        "classroom",
        "lecture",
        "lab",
        "study",
        "office",
        "library",
        "auditorium",
        "meeting",
        "service",
        "seminar",
        "hall",
        "common",
        "toilet",
        "stairwell",
        "lift",
        "other",
      ],
    },
    status(["available", "occupied", "maintenance", "closed"]),
    {
      key: "capacity",
      label: "Room capacity",
      type: "number",
      group: "Space & plan anchor",
      required: true,
      initial: "0",
      min: 0,
      max: 2147483647,
      step: "1",
      hint: "Physical capacity metadata, not the queue admission limit.",
    },
    {
      key: "area_m2",
      label: "Area (m²)",
      type: "number",
      group: "Space & plan anchor",
      min: 0.01,
      max: 999999.99,
      step: ".01",
    },
    ...["x", "y"].map((axis) => ({
      key: "plan_" + axis,
      label: `Plan ${axis} (m)`,
      group: "Space & plan anchor",
      type: "number" as const,
      min: -999999.9999,
      max: 999999.9999,
      step: ".0001",
    })),
    ...coordinates,
    visibility,
    {
      key: "requires_admission",
      label: "Admission ticket required",
      group: "Visibility & admission",
      type: "boolean",
      initial: "false",
      hint: "A queue must be configured separately in Services. This switch does not create one.",
    },
  ],
};
export interface CampusRow {
  id: string;
  kind: CampusKind;
  code: string;
  name: string;
  data: Record<string, unknown>;
  values: Record<string, string>;
}
export function campusRow(kind: CampusKind, value: unknown): CampusRow {
  const r = record(value),
    values: Record<string, string> = {};
  for (const field of campusFields[kind]) {
    const v = r[field.key];
    if (field.type === "number") {
      if (v !== null && (typeof v !== "number" || !Number.isFinite(v)))
        throw new ApiError(
          502,
          "The campus record contains incomplete numeric metadata. Refresh before editing.",
        );
    } else if (field.type === "boolean") {
      if (typeof v !== "boolean")
        throw new ApiError(
          502,
          "The campus record is missing its policy values.",
        );
    } else if (v != null && typeof v !== "string")
      throw new ApiError(502, "The campus record is incomplete.");
    values[field.key] = v == null ? "" : String(v);
  }
  if (kind === "floors") identity(r.building_id);
  if (kind === "rooms") identity(r.floor_id);
  identity(r.status);
  return {
    id: identity(r.id),
    kind,
    code: identity(r.code),
    name: identity(r.name),
    data: r,
    values,
  };
}
export async function campusPage(kind: CampusKind, query: ListQuery) {
  const raw = await {
    buildings: adminApi.buildings,
    floors: adminApi.floors,
    rooms: adminApi.rooms,
  }[kind](query);
  const r = record(raw),
    meta = pageMeta(r.meta),
    items = rows(r.items).map((v) => campusRow(kind, v));
  if (
    meta.page !== (query.page ?? 1) ||
    items.length > meta.per_page ||
    meta.total < items.length ||
    new Set(items.map((i) => i.id)).size !== items.length ||
    meta.total_pages !== Math.max(1, Math.ceil(meta.total / meta.per_page))
  )
    throw new ApiError(
      502,
      "The campus directory returned inconsistent pagination. Please refresh.",
    );
  return { items, meta };
}
export function campusBody(
  kind: CampusKind,
  values: Record<string, string>,
  existing?: CampusRow,
) {
  const body: Record<string, unknown> = {};
  for (const f of campusFields[kind]) {
    if (existing && values[f.key] === existing.values[f.key]) continue;
    const v = values[f.key]?.trim() ?? "";
    if (f.required && !v) throw new Error(`${f.label} is required.`);
    body[f.key] =
      f.type === "boolean"
        ? v === "true"
        : f.type === "number"
          ? v === ""
            ? null
            : Number(v)
          : v || null;
    if (
      f.type === "number" &&
      v &&
      (!Number.isFinite(Number(v)) ||
        (f.min !== undefined && Number(v) < f.min) ||
        (f.max !== undefined && Number(v) > f.max))
    )
      throw new Error(`Check ${f.label.toLowerCase()}.`);
  }
  return body;
}
export async function saveCampus(
  kind: CampusKind,
  body: Record<string, unknown>,
  existing?: CampusRow,
) {
  const v = existing
    ? await {
        buildings: adminApi.updateBuilding,
        floors: adminApi.updateFloor,
        rooms: adminApi.updateRoom,
      }[kind](existing.id, body)
    : await {
        buildings: adminApi.createBuilding,
        floors: adminApi.createFloor,
        rooms: adminApi.createRoom,
      }[kind](body);
  const row = campusRow(kind, v);
  if (
    (existing &&
      (row.id !== existing.id ||
        (kind === "floors" &&
          row.data.building_id !== existing.data.building_id) ||
        (kind === "rooms" && row.data.floor_id !== existing.data.floor_id))) ||
    Object.entries(body).some(([k, expected]) => row.data[k] !== expected)
  )
    throw new ApiError(
      502,
      "The server did not confirm the requested fields. Refresh before trying again; the change may already have been applied.",
    );
  return row;
}
export async function removeCampus(row: CampusRow) {
  const v = await {
    buildings: adminApi.deleteBuilding,
    floors: adminApi.deleteFloor,
    rooms: adminApi.deleteRoom,
  }[row.kind](row.id);
  if (record(v).deleted !== row.id)
    throw new ApiError(
      502,
      "The server did not confirm removal of this record. Refresh before trying again.",
    );
}
