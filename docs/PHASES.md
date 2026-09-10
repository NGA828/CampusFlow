# CampusFlow — Delivery Phases & Status

Status legend: ✅ Done · 🟡 In progress · ⬜ Not started.
"Backend" work is written to `backend/` and covered by tests; note that this
sandbox cannot execute PHP/PostgreSQL/Redis (see note at the bottom), so
backend items are verified by review + the test suite run in a full
environment, while frontend/mobile items are verified here (typecheck, lint,
build, preview).

| # | Phase | Status | Notes |
|---|-------|--------|-------|
| 1 | Repository inspection · architecture · env config · DB connection · API foundation | 🟡 | Inspection ✅; architecture docs ✅; frontend `.env.example` ✅; centralized API client + contract ✅; backend DB connection ⬜ |
| 2 | Authentication · roles · permissions | 🟡 | Frontend login + session + role redirect ✅ (mock); Sanctum backend + roles ⬜ |
| 3 | Users · students · staff · administrators | ⬜ | |
| 4 | Campus infrastructure: buildings, floors, rooms, floor plans | ⬜ | |
| 5 | QR nodes · navigation nodes · edges · spatial data | ⬜ | |
| 6 | Timetable: courses, enrollments, class sessions | 🟡 | Frontend timetable screen ✅ (mock); backend domain ⬜ |
| 7 | Room availability | ⬜ | |
| 8 | Navigation engine (A*/Dijkstra) | ⬜ | |
| 9 | Student QR positioning | ⬜ | |
| 10 | Standard room admission queue (concurrency-safe) | ⬜ | |
| 11 | Administrative office ticket system | ⬜ | |
| 12 | Real-time WebSocket events (Reverb/Echo) | ⬜ | |
| 13 | Notifications | ⬜ | |
| 14 | AI Campus Assistant (controlled tools) | ⬜ | |
| 15 | AI room recommendations | ⬜ | |
| 16 | Queue wait-time prediction foundation | ⬜ | |
| 17 | Staff dashboards (queue management) | ⬜ | |
| 18 | Admin dashboards (analytics, spatial editor) | ⬜ | |
| 19 | Polish: motion, loading/error/empty, accessibility | 🟡 | Design system + state components ✅; per-screen polish ongoing |
| 20 | End-to-end testing & bug fixing | ⬜ | |

## Critical end-to-end workflows (from the brief)

| # | Workflow | Status |
|---|----------|--------|
| 1 | Login → dashboard → timetable → next class | 🟡 (frontend/mock) |
| 2 | Scan QR → position → room → route → navigate | ⬜ |
| 3 | Off-route detection → warning → recalculate | ⬜ |
| 4 | Room search → availability → details | ⬜ |
| 5 | Join queue → geofence → ticket → unique position | ⬜ |
| 6 | Two simultaneous joins → distinct positions | ⬜ |
| 7 | Queue update → WebSocket → UI updates | ⬜ |
| 8 | Called → notification → navigate → check-in | ⬜ |
| 9 | No check-in → grace → NO_SHOW/EXPIRED → next called | ⬜ |
| 10 | Office ticket full lifecycle (request → completed) | ⬜ |
| 11 | Cancel office ticket → CANCELLED → positions update | ⬜ |
| 12 | Unauthorized admin endpoint → 403 | ⬜ |
| 13 | Unauthenticated protected endpoint → 401 | ⬜ |
| 14 | Invalid request → 422 → useful frontend message | 🟡 (login form; more to come) |

## Environment note (important)

This workspace ships Node.js (npm registry reachable) but **not** PHP,
Composer, PostgreSQL, PostGIS or Redis — and the package registries / apt
mirrors needed to install them are not reachable here. Therefore:

- **Frontend** (Next.js) and **mobile** (Expo) are installed, built and
  verified in this environment.
- **Backend** (Laravel) source, migrations, factories, seeders and PHPUnit
  tests will be written and committed, but must be executed in an environment
  with the PHP/PostgreSQL/Redis stack (`composer install && php artisan test`).
- Until the backend is reachable, the frontend runs against a **clearly-marked
  development mock** that implements the same contract (`docs/API.md`), so UI
  work is verifiable now and switches to live with a config change
  (`NEXT_PUBLIC_API_URL`).
