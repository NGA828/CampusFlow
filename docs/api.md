# CampusFlow — API Reference & Specifications

> Base URL: `http://localhost:8001/api/v1`  
> Authentication: Bearer token via Laravel Sanctum (`Authorization: Bearer <token>`)

---

## 1. Authentication & User Profile (`/auth`, `/me`)

### `POST /auth/login`
- **Body**: `{ email, password }`
- **Response**: `{ success: true, token: string, user: User }`

### `POST /auth/register`
- **Body**: `{ name, email, password, role?: 'student' | 'staff' }`
- **Response**: `{ success: true, token: string, user: User }`

### `GET /auth/me` / `GET /me`
- **Response**: `{ success: true, user: User }`

### `GET /me/dashboard`
- **Response**: `{ success: true, data: { user, today, next_class, queue_ticket, office_ticket, unread_count, upcoming_events, building_alerts } }`

---

## 2. Room Admission Queues (`/queues`, `/rooms/{id}/queue`)

### `GET /queues`
- **Response**: List of all room queues, waiting count, status, estimated wait.

### `POST /rooms/{room}/queue/join` or `POST /queues/{id}/tickets`
- **Body**: `{ position_lat?: float, position_lng?: float }`
- **Response**: `{ success: true, ticket: QueueTicket, position: int, estimated_wait_minutes: int }`

### `POST /queue-tickets/{id}/check-in`
- **Body**: `{ qr_payload?: string, lat?: float, lng?: float }`
- **Response**: `{ success: true, ticket: QueueTicket }`

---

## 3. Administrative Office Ticketing (`/offices`, `/office-tickets`)

### `GET /offices`
- **Response**: List of campus administrative offices, open service windows, queue length, average service duration.

### `POST /offices/{id}/tickets`
- **Body**: `{ service_window_id?: string, service_type?: string }`
- **Response**: `{ success: true, ticket: OfficeTicket, estimated_window: TimeWindow }`

### `POST /office-tickets/{id}/check-in`
- **Body**: `{ lat?: float, lng?: float }`
- **Response**: `{ success: true, ticket: OfficeTicket }`

---

## 4. Positioning & Spatial Navigation (`/positioning`, `/navigation`)

### `POST /positioning/scan`
- **Body**: `{ qr_payload: string }`
- **Response**: `{ success: true, position: LocationFix, room: Room, floor: Floor, building: Building }`

### `POST /navigation/route`
- **Body**: `{ origin: { x, y, floor_id }, destination: { room_code } }`
- **Response**: `{ success: true, path: Node[], total_distance_m: float, instructions: Instruction[] }`

---

## 5. Staff Operations (`/staff/*`)

- `GET /staff/dashboard`
- `GET /staff/queues/{id}/line`
- `POST /staff/queues/{id}/call-next`
- `POST /staff/queue-tickets/{id}/admit`
- `POST /staff/office-tickets/{id}/start-service`
- `POST /staff/office-tickets/{id}/complete`

---

## 6. Administration & Governance (`/admin/*`)

- `GET /admin/dashboard`, `GET /admin/analytics`, `GET /admin/audit-logs`
- CRUD for `users`, `buildings`, `floors`, `rooms`, `qr-nodes`, `navigation-nodes`, `courses`, `terms`, `enrollments`, `queues`, `offices`.

## Web coordination contract corrections — 2026-09-16

These audited contracts supersede conflicting older summaries for the endpoints below. Requests use
Sanctum, the existing role/platform/permission middleware, and the JSON `success` / `data` envelope.
No new route or permission was introduced by this redesign.

- **GET `/staff/dashboard`**: active staff only. Queues/offices, pending identities and aggregate
  counts are restricted to the existing operation policies AND the corresponding permission. Closed
  assigned queues remain visible. Pending office rows include `office_id` for direct console links.
  `teaching_today` is the lecturer's current-term/day schedule when teaching permission is present.
  `kpis.waiting_now` counts waiting tickets only; `served_today` counts today's recorded room
  admissions plus office completions. `offices_open` is the legacy name for the enabled flag count,
  not a computed opening-hours signal. `campus_time` supplies the server date/time context.
- **GET `/campus/events`**: published event paginator; items now include server-derived `can_manage`
  for the staff author with content-management permission. Other authors are view-only in the editor.
- **POST `/staff/events`**, **PATCH `/staff/events/{id}`**: content-management permission, plus author
  ownership for editing. Fields: `title`, `description?`, `category?`, `starts_at`, `ends_at?`, `venue?`,
  `capacity?` (positive integer). Start/end validated; end must follow start. Create sets `created_by`
  from the principal and status `published`; response `data.event`. Unsupported building/pinned/
  registration flags are not presented as functional form controls.
- **DELETE `/staff/events/{id}`**: author-scoped soft deletion; other authors/unowned legacy events
  return404. The UI requests explicit review before writing.
- **GET `/staff/announcements`**: author-owned announcement ledger. **POST** accepts `title`, `body`,
  `priority?` (`low|normal|high|urgent`) and `target_roles?` (null for campus, otherwise a nonempty role
  allow-list). Stores `created_by` and `published_at`; response `data.announcement`. **DELETE
  `/staff/announcements/{id}`** is author-scoped. No real-time delivery guarantee is made.
- **GET `/admin/users`**: accepts `role`, `q` (name/email/registration), `page`, `per_page` (1–100).
  Raw rows use `role`; raw meta uses `current_page/last_page`. The central web adapter projects these
  to `role_code` and `page/total_pages`. Missing pagination is an error, not a guessed first page.
- **POST `/admin/users`**: `name`, `email`, `role`, optional password (minimum8), registration and
  department. Returns `data.user` and generated `data.password` when no password was supplied.
- **PATCH `/admin/users/{user}`**: profile/status fields only; `role` is prohibited. Status supports
  `active|suspended` and is explicitly assigned inside the authorized controller. Self/last-active-admin
  suspension is rejected409. **PATCH `/admin/users/{user}/role`** remains the separate audited role
  operation with existing self-demotion/last-admin guards. They are not an atomic combined edit.
- **DELETE `/admin/users/{user}`**: self/last-active-admin deactivation rejected409; other accounts
  have tokens revoked and are soft-deleted. Related retention follows existing database policies.
  **POST `/admin/users/{user}/reset-password`** returns a new password; existing session invalidation
  is not promised for this endpoint. Passwords are not placed in toasts or browser storage by the UI.
- **GET `/admin/staff-assignments`**: existing assignment list plus `people` (staff/admin identity
  catalogue) and `scopes` (`building|floor|room|office|course`, each `{id,label}[]`). Not tied to user
  search/pagination. **POST** validates eligible principal, supported type, existing scope UUID,
  responsibility label and boolean flags; returns `data.assignment`. **DELETE /{id}** removes the row.
  An assignment is context, not a permission guarantee: flags are only meaningful where current
  policies consume them. Office scope does not currently depend on the ticket flag; content ownership
  is checked separately. Unknown/unsupported queue-type assignments cannot be newly created here.

UI fixtures and static gates do not execute these Laravel/database contracts. Four regression tests
were added to StaffTest/AdminTest; PHP runtime dependencies were unavailable in the redesign sandbox.
The last-administrator checks are not asserted to be concurrency-safe; that remains backend hardening.

### 2026-09-16 — Operational alert snapshot and acknowledgement correction

Routes and web/mobile permission gates are unchanged: `GET /admin/alerts`, `POST /admin/alerts/ack` with `{fingerprint, note?}`. Successful acknowledgement returns `{acknowledged: fingerprint}`; the web client checks exact equality, not just transport success.

`alerts[].key` is an opaque fingerprint to round-trip unchanged. It now includes a short hash of reported severity/title/detail/target, so a changed report does not inherit an older mute. Existing pre-hash acknowledgements may prompt one re-review. Identical fingerprints can remain muted; this is not a persistent incident timeline, recurrence detector or resolution service. Optional notes are limited to 300 characters, fingerprints to 160. No optimistic local mute overrides a fresh server snapshot.

Severity counts use the same derived array returned by the feed. The web client validates raw shape and computes critical/warning counts from that exact array; `counts.acknowledged` remains the total stored fingerprint records, not resolved conditions or the number currently hidden. Closed-office ticket alerts count only remaining tickets at active offices with their open switch off, not tickets at unrelated open offices.

Only known console paths become investigation links in the web projection. Loading/failed/malformed reads do not become zero/healthy reports. HTTP 401 still triggers the centralized session-expired login flow. Three new Laravel tests are present but unrun without PHP/Composer; browser fixtures are not deployed-backend certification.

### Administrator campus directory (2026-09-16)

Existing `/api/v1/admin/{buildings,floors,rooms}` GET/POST and corresponding
`/{id}` PATCH/DELETE routes keep their centralized transport and administrator permission checks.

- GET accepts `q` (up to120 characters), positive `page`/`per_page` (page size capped100).
  Code/name search is server-side. Floor search also matches signed integer `level`, including0.
  Floors support `building_id`; rooms support `building_id` and `floor_id` (UUIDs). Search OR
  clauses are grouped inside the parent scope. Results use `data.items` and `data.meta`.
- Building list records include actual `floors_count`; floor lists include `rooms_count`,
  `building_code` and `building_name`; room lists include `building_id`. Counts are directory
  metadata, not live occupancy. Stable secondary ID ordering supports paging.
- Creation requires code/name; floors also require building UUID and signed32-bit level;
  rooms require floor UUID. Building/room codes are globally unique; floor codes are unique
  within their building. Creation checks a non-deleted parent under a transaction/row lock.
  Parent IDs are **prohibited on PATCH**, not silently ignored.
- PATCH validates only supplied fields. Nullable coordinates stay null; zero is a valid
  coordinate, floor level or room capacity. Latitude/longitude use ±90/±180 bounds. Floor
  dimensions (`plan_width_m`, `plan_height_m`) and room `area_m2` are nullable or0.01…999999.99;
  room anchors `plan_x/y` are nullable within±999999.9999. Numeric inputs may carry computed
  spatial precision; database decimal rounding applies. Capacity is0…2147483647.
- Supported metadata remains writable: building description/address/footprint/image/public
  policy; floor plan URL/SVG; room features/type/status/image/admission/access/public policy.
  The campus editor sends dirty fields only and leaves advanced spatial/policy metadata intact.
  `campus_name`, floor `plan_width/plan_height`, room `room_type/plan_w/plan_h` are rejected;
  these are not stored aliases. Admission configuration does not create a room queue.
- Successful create/update returns the fresh record in `data` (201/200). The web adapter checks
  identity, sent fields and immutable parents before dismissing a draft; incomplete or
  contradictory confirmations remain errors even with HTTP200.
- DELETE soft-deletes only an unused record and returns `{success:true,data:{deleted:"<id>"}}`.
  Linked records, including historical/soft-deleted references and scoped staff assignments,
  cause409. Use a closed status for a previously used place. Guards cover the reference tables
  enumerated in `CampusConfiguration::remove`; locks here do not certify every other reference
  writer or global concurrency safety.

Five Laravel feature tests cover these contracts but remain **unexecuted** without PHP/Composer.
Browser verification uses raw-wire fixtures; it is not production authorization/database evidence.
