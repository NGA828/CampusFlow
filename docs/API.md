# CampusFlow — API Contract

This document is the single source of truth for the API contract shared by the
backend, web and mobile apps. Endpoints are added here **before** frontend
integration; frontends never call endpoints that aren't documented.

> Status key: **Implemented** = backend + frontend wired; **Contracted** =
> shape defined here, backend/frontend pending (frontend may use the dev mock);
> **Planned** = scheduled but not yet contracted.

---

## Conventions

- Base URL: `{APP_URL}/api` (web reads `NEXT_PUBLIC_API_URL`, mobile reads
  `EXPO_PUBLIC_API_URL`).
- All JSON. `Content-Type: application/json`; authenticated requests send
  `Authorization: Bearer {token}`.

### Envelope

Success:

```json
{ "success": true, "data": { }, "message": "…" }
```

Error:

```json
{ "success": false, "message": "…", "errors": { "field": ["…"] } }
```

### Status codes

| Code | Meaning |
|------|---------|
| 200 | OK |
| 201 | Created |
| 204 | No content |
| 400 | Bad request |
| 401 | Unauthenticated |
| 403 | Forbidden (role/ownership) |
| 404 | Not found |
| 409 | Conflict (already queued, capacity full, …) |
| 422 | Validation failed |
| 429 | Rate limited |
| 500 | Server error |

---

## Auth

### `POST /auth/login` — **Implemented** (mock) · Contracted (backend)

Authorization: none

Request:

```json
{ "email": "greyson@campusflow.app", "password": "…" }
```

Response `200`:

```json
{ "success": true, "message": "Signed in successfully.",
  "data": { "token": "…", "user": { "id": "…", "name": "…", "email": "…", "role": "student" } } }
```

Errors: `422` (missing fields), `401` (bad credentials).

### `POST /auth/logout` — **Implemented** (mock) · Contracted (backend)

Authorization: any authenticated user. Response `200` / `204`.

### `GET /me` — **Implemented** (mock) · Contracted (backend)

Authorization: any authenticated user. Returns the current `User`.

---

## Student

### `GET /student/dashboard` — **Implemented** (mock) · Contracted (backend)

Authorization: `student`.

Response `200`:

```json
{ "success": true, "data": {
  "greeting": "Good morning",
  "today_count": 4,
  "next_class": { "id": "…", "course": { "code": "CSC 301", "name": "Database Systems" },
    "room": { "code": "B204", "building": { "name": "Engineering Building", "short": "ENG" }, "floor": 2 },
    "starts_at": "…", "ends_at": "…", "instructor": "…", "type": "lecture",
    "minutes_until_start": 23 },
  "today_classes": [ … ],
  "queue_ticket": { "id": "…", "ticket_no": "P-024",
    "office": { "name": "Principal's Office", "building": "Administration Building" },
    "position": 3, "people_ahead": 2, "estimated_wait_minutes": 12,
    "expected_window": "11:40 AM – 11:50 AM", "status": "approaching" },
  "announcements": [ … ],
  "nearby_rooms": [ … ]
} }
```

Errors: `401`.

### `GET /student/timetable?date=YYYY-MM-DD` — **Implemented** (mock) · Contracted (backend)

Authorization: `student`. `date` optional (defaults to today).

Response `200`:

```json
{ "success": true, "data": { "date": "2026-09-10", "classes": [ … ] } }
```

Errors: `401`, `422` (invalid date).

---

## Rooms

### `GET /rooms?query=&type=&building=` — **Implemented** (mock, search only) · Contracted (backend)

Authorization: any authenticated user.

Response `200` (paginated):

```json
{ "success": true, "data": { "data": [ { "id", "code", "name", "building", "floor", "capacity", "type", "status" } ],
  "meta": { "current_page": 1, "per_page": 20, "total": 3, "last_page": 1 } } }
```

Errors: `401`.

---

## Planned endpoints (contracted in upcoming phases)

The remaining surface is scheduled phase-by-phase in `docs/PHASES.md`. It
includes (not yet contracted in detail):

- Campus: `GET /campus/buildings`, `GET /buildings/{id}/floors`, `GET /rooms/{id}`,
  `POST /rooms/{id}/availability`, floor-plan + spatial-node endpoints (admin).
- Navigation: `POST /navigation/position`, `POST /navigation/route`,
  `POST /navigation/sessions`, `POST /navigation/sessions/{id}/position`.
- QR: `POST /positioning/resolve-qr`.
- Room queues: `GET/POST /student/queues`, `POST /student/queues/{queue}/tickets`,
  `GET /student/queues/{queue}/tickets/{ticket}`, `DELETE …/tickets/{ticket}`,
  `POST …/tickets/{ticket}/check-in`; staff/admin equivalents.
- Administrative offices: `GET /student/offices`, `GET /student/offices/{id}`,
  `POST /student/offices/{id}/tickets`, ticket status/cancel/check-in endpoints;
  staff queue-management endpoints.
- Notifications: `GET /notifications`, `POST /notifications/{id}/read`.
- AI: `POST /ai/assistant/chat`.
- Admin: users, roles, buildings/floors/rooms, spatial editor, QR nodes,
  navigation graph, queue config, office config, analytics.

Each will be documented here with METHOD / URL / AUTHORIZATION / REQUEST /
RESPONSE / ERRORS before frontend wiring.
