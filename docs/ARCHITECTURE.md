# CampusFlow — Architecture

This document records the architectural decisions that shape CampusFlow. It is
kept up to date as phases land.

---

## 1. Guiding principle: the backend is authoritative

AI and frontends **interpret and present**; the Laravel backend **decides**.

Concretely: a student asks the AI "can I join the queue for B204?". The AI
extracts `intent=JOIN_QUEUE, room=B204` and invokes a controlled backend tool.
Laravel then checks, in order:

1. Is the caller authenticated?
2. Does the room exist and accept queue requests?
3. Is the student within any required proximity/geofence?
4. Is capacity available?
5. Does the student already hold a ticket?
6. What is the current queue state?

Only then is a ticket created inside a transaction. **The AI never touches the
database directly** and cannot set positions, capacity or tickets.

The same principle applies to the frontends: they render state, but never
compute authoritative positions, capacity limits or geofence verdicts.

---

## 2. Monorepo & feature-oriented organisation

Each app is independently buildable, but all three share one API contract
(`docs/API.md`).

**Frontend** (`frontend/`)

```
app/                # route groups: (auth), student/, staff/, admin/
features/           # authentication, dashboard, timetable, campus-map,
                    # navigation, rooms, queue, administrative-office,
                    # notifications, events, announcements, ai-assistant, profile
components/ui/      # design-system primitives
components/layout/  # app shells (student/staff/admin)
lib/api/            # centralized client, contract types, (dev) mock
lib/auth/           # token/session handling
lib/websocket/      # Echo client + channel config
hooks/              # useApiResource, useSession, …
types/              # shared domain types
```

**Mobile** (`mobile/`) mirrors this with `features/`, `services/api`,
`services/websocket`, `services/location`, `services/notifications`.

**Backend** (`backend/app/`)

```
Models/
Http/Controllers/   Auth, Student, Staff, Admin, Navigation, Rooms, Queue,
                    AdministrativeOffice, Notifications, AI
Http/Requests/      per-endpoint validation
Http/Resources/     per-domain JSON resources (the contract)
Services/           Authentication, Timetable, Campus, Navigation, Positioning,
                    Rooms, Queue, AdministrativeOffice, Notifications, AI
Actions/            single-responsibility business operations (queue join, …)
Policies/           authorization
Events/ Listeners/ Jobs/ Notifications/
```

**A feature never spreads its logic across unrelated modules** — queue logic
lives in `Services/Queue` + `Http/Controllers/Queue`; navigation logic in
`Services/Navigation`; office tickets in `Services/AdministrativeOffice`.

---

## 3. API foundation

- Single entry: `routes/api.php` with the `api` middleware group.
- Standard envelope: `{ success, data?, message?, errors? }` (see `docs/API.md`).
- JSON exceptions for `api/*` requests (configured in `bootstrap/app.php`).
- Validation in `FormRequest` classes → `422` with field errors.
- Auth via Laravel Sanctum bearer tokens; role + ownership checks in Policies.

---

## 4. Data model (normalized, PostGIS-aware)

Core entities:

| Domain | Entities |
|--------|----------|
| Identity | `users`, `roles`, `permissions`, `students`, `staff` |
| Academic | `courses`, `enrollments`, `timetables`, `class_sessions` |
| Campus | `buildings`, `floors`, `rooms`, `floor_plans` |
| Spatial | `qr_nodes`, `navigation_nodes`, `navigation_edges` |
| Availability | `room_availability` |
| Queue | `admission_queues`, `queue_tickets`, `queue_events`, `queue_checkins` |
| Offices | `administrative_offices`, `office_services`, `office_service_windows`, `office_tickets`, `office_checkins` |
| Content | `events`, `announcements`, `notifications` |
| AI | `ai_conversations`, `ai_messages` |
| Tracking | `navigation_sessions`, `location_updates` |

Rules:

- Foreign keys + indexes on every relation; unique constraints where required.
- `navigation_nodes` and `rooms` store spatial columns (PostGIS `geometry`) plus
  explicit `x/y/z` coordinates for indoor use.
- Location data is stored only when a feature needs it (privacy-by-design).

---

## 5. Queue concurrency (critical)

Positions are **never** `max(position)+1` without protection. A join is:

```
BEGIN
  SELECT … FROM admission_queues WHERE id = ? FOR UPDATE   -- row lock
  SELECT COALESCE(MAX(position), 0) + 1 …                  -- inside the lock
  INSERT INTO queue_tickets …
COMMIT
```

A database constraint additionally guarantees `(queue_id, position)` uniqueness,
so a duplicate position is impossible even under a bug. Capacity and geofence
checks run inside the same transaction.

---

## 6. Navigation engine

- Graph: `navigation_nodes` (vertices) + `navigation_edges` (weighted edges,
  incl. stair/elevator costs and floor transitions).
- Shortest path: **A\*** (with Dijkstra as fallback) implemented in
  `Services/Navigation`.
- The AI may *recommend* routes (congestion, accessibility, preference) but the
  **valid route always comes from the navigation engine**.

## 7. Positioning (QR anchors)

`QR-ENG-02-F2-014` → `qr_nodes` row → `{building: Engineering, floor: 2, x:143.4,
y:81.2, z:2}`. Scanning resolves the node server-side (or via a cached copy
with server validation); the resolved node becomes the student's **known
position**. Sensor fusion can refine this later without changing the model.

## 8. Geofencing

A queue/office may require proximity. The backend computes the distance between
the student's last reported position and the target and compares it to the
configured radius. Verdicts are **backend-only**; grace periods prevent spurious
cancellations from brief GPS deviations.

## 9. Realtime

Laravel Reverb broadcasts domain events (`QueuePositionUpdated`,
`TicketCalled`, `TicketExpired`, `TicketCancelled`, `StudentCheckedIn`,
`OfficeTicketUpdated`, `RoomAvailabilityChanged`, `NotificationCreated`).
Clients subscribe over Echo to private, authorization-checked channels.
Broadcasts are filtered so clients only receive what they're entitled to.

## 10. AI assistant

- A Laravel **AI service** exposes a fixed set of tools
  (`get_student_schedule`, `get_next_class`, `get_room_details`,
  `search_available_rooms`, `get_current_position`, `calculate_route`,
  `get_queue_status`, `join_queue`, `cancel_queue_ticket`, …).
- Each tool maps to an existing service/action **behind the same authN/authZ**.
- The LLM is given tool schemas + current user context; it never receives
  credentials or unrestricted DB access.

## 11. Security

- Sanctum bearer auth; Policies for every protected action; role + ownership
  checks server-side (frontend role checks are cosmetic only).
- Rate limiting on auth and queue-join endpoints; input validation everywhere.

## 12. Performance

- Pagination on list endpoints; eager loading to avoid N+1; indexes on hot
  paths; caching of read-heavy campus data; debounced location updates;
  broadcast only meaningful events.

---

## Decision log (ADR)

| # | Decision | Rationale |
|---|----------|-----------|
| ADR-01 | Monorepo (backend + frontend + mobile) | One contract, one repo, feature-oriented modules |
| ADR-02 | Backend-authoritative architecture | Security + correctness; AI/frontends are presentation |
| ADR-03 | PostgreSQL + PostGIS | Relational integrity + spatial queries in one store |
| ADR-04 | Standard JSON envelope + status codes | Predictable client error handling |
| ADR-05 | Sanctum tokens (not OAuth2) | Right-sized for first-party apps; matches scaffold |
| ADR-06 | A*/Dijkstra in Laravel, not client | Deterministic, authoritative routing |
| ADR-07 | Feature-oriented folders | Maintainability; no god-modules |
| ADR-08 | Clearly-marked dev mock in frontend | Design/preview before API; never presented as real |
