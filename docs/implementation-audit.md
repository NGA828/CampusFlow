# CampusFlow implementation audit

**Audit date:** 2026-09-11  
**Scope:** repository inspection only. No production data, configuration, or application code was changed.

## Executive summary

CampusFlow has substantial web, mobile, and Laravel implementations, but it is **not ready for feature expansion or production use**. The queue and office API-contract regression identified in this audit has been repaired and is now covered by endpoint tests; broader client/schema convergence remains necessary.

A second, competing Fastify/PGlite backend remains in `server/`, while the product requirements make Laravel + PostgreSQL/PostGIS authoritative. This must be retired, isolated as an explicitly unsupported prototype, or brought into a deliberate migration plan before further development.

## Current architecture

| Area | Observed implementation | Status |
| --- | --- | --- |
| Web | Next.js 16, TypeScript, Tailwind 4, centralized Axios client, route groups and a custom proxy | Implemented; lint passes |
| Mobile | Expo 57, expo-router, centralized client, secure token storage, camera/location/notification dependencies | Implemented; type/export checks pass |
| Primary API | Laravel REST API under `/api/v1`, Sanctum middleware, PostgreSQL configuration, migrations, seed data and PHPUnit feature tests | Implemented but contract-broken in critical domains |
| Realtime | Web client proxy/WebSocket context and Laravel Reverb configuration exist | Not integrated as Laravel Reverb/Echo events and authorized channels |
| Duplicate API | Fastify/PGlite implementation remains in `server/`; supported web and mobile defaults now target Laravel | Must be retired or isolated to preserve the authoritative-backend requirement |

## Implemented coverage

- Auth: registration, login, logout, password reset, profile endpoints and Sanctum personal tokens.
- Student foundations: dashboard, timetable, rooms, building/floor plans, QR positioning, navigation sessions, events, announcements, notifications and AI chat.
- Operations: staff and admin routes, campus/academic configuration, office/queue schemas, seed data and corresponding web screens.
- UI research: `docs/design-research.md` records source links, comparisons, implementation notes and screen scores of at least 8/10.

## Blocking defects

### 1. Queue and office API contracts are broken

`routes/api.php` registers these queue controller actions which are absent from `QueueController`: `index`, `showById`, `joinByQueueId`, `ticketDetails`, `cancelTicket`, `checkInTicket`, `setNavigating`, and `proximityCheck`.

It also registers these missing office controller actions: `showTicket`, `checkInTicket`, `approachingTicket`, and `cancelTicket`.

The web and mobile API clients invoke these endpoints. Laravel can list such routes but fails only when dispatching them, which is why the existing tests do not expose the problem. Restore one canonical controller contract, then add contract tests for every client-used endpoint before modifying the UI.

### 2. The queue implementation is not yet safe enough

- `QueueController::join()` locks the queue row, but it generates its own idempotency value instead of honoring the client-provided idempotency key.
- The database constraint `UNIQUE(queue_id, user_id, status)` does **not** enforce one active ticket: a user can have tickets in multiple active statuses. Use a PostgreSQL partial unique index over the active statuses.
- There is no database unique constraint for `(queue_id, position)`, and admission increments occupancy without a capacity check or transition validation.
- The current controller implementation does not enforce proximity/geofence eligibility, check-in windows, expiry/no-show processing, or authorized staff scope for a particular room.

### 3. Spatial foundation does not meet the PostGIS requirement

The Laravel migrations store coordinates as decimals and footprints/plans as JSON. No migration enables PostGIS, creates `geometry`/`geography` columns, or creates GiST spatial indexes. The health endpoint merely detects PostGIS if it happens to be installed. Establish the extension, authoritative spatial columns, indexes, and deterministic distance queries before claiming PostGIS-backed positioning or geofencing.

### 4. Realtime is incomplete and divergent

Laravel broadcasting defaults to `log`, there are no broadcast event classes, and `routes/channels.php` authorizes only the default user model channel. The frontend still connects to a custom `/api/ws` protocol. Choose Laravel Reverb + Echo as required, define authorized user/queue/office channels, broadcast state changes after committed transactions, and remove the parallel protocol.

### 5. Authorization is controller-local rather than policy-based

Most route groups use only `auth:sanctum`; authorization is performed inconsistently in controller helpers/role checks. No Laravel policies were found. Add policies and scope checks for staff assignments, queue/office operations, infrastructure updates, and ownership actions. Frontend role visibility must remain presentation-only.

## Database status

Migrations provide UUIDs, foreign keys, indexes, soft deletes, academic data, spatial-adjacent data, queues, offices, engagement, and Sanctum tokens. Seed data and `RefreshDatabase` feature tests exist. Missing: PostGIS extension/schema, spatial indexes, effective active-ticket constraints, queue-position uniqueness, capacity enforcement at the database/application transition boundary, and explicitly modeled queue timeout/check-in semantics.

## API and client status

The registered Laravel API surface is broad and documented in `docs/api.md`. The two clients use centralized URL configuration (`NEXT_PUBLIC_API_URL` and `EXPO_PUBLIC_API_URL`) and do not scatter hardcoded backend URLs. However, client endpoint types have drifted ahead of their Laravel controller implementations, notably queue/office tickets; frontend-only build success is therefore not integration success.

## Testing status

| Check | Result |
| --- | --- |
| Laravel feature suite | Passes: 29 tests, 106 assertions |
| Frontend lint | Passes |
| Mobile TypeScript and web export | Passes |
| Queue/office client-contract tests | Missing; legacy tests do not hit the registered current routes |
| Concurrent queue-position/capacity test | Missing |
| Realtime channel authorization/delivery test | Missing |
| Browser/device E2E and accessibility verification | Missing |

The attempted production frontend build began successfully but did not return a completion result in the audit window; it should be rerun after resolving the API baseline.

## Documentation and design status

Existing documents cover architecture, API, database, responsive behavior, and design research. Required implementation documents are absent or incomplete: navigation, queue system, administrative office, AI assistant, testing, deployment, and per-screen records under `docs/design-decisions/`. The design-research document is a strong base, but the missing decision records mean the documentation gate is not fully met.

## Security concerns

1. Route/controller drift creates unhandled failures for core actions.
2. The competing Fastify/PGlite path undermines the Laravel/PostgreSQL source-of-truth rule.
3. Queue and office workflows lack demonstrated authorization scope, state-transition and capacity guarantees.
4. QR scanning accepts a known active code but has no demonstrated signature/version verification beyond the record lookup.
5. Realtime authorization and transport do not match the stated Laravel Reverb architecture.
6. The committed example environment includes a development database password; ensure no real credentials are committed and rotate it if reused.

## Recommended implementation order

1. **Freeze UI expansion and select Laravel as the only supported backend.** Reconfigure the web proxy and mobile environment to target it; quarantine or remove the Fastify/PGlite implementation only after confirming it is unused.
2. **Repair the queue and office contract.** Reconcile `routes/api.php`, controllers, resources and both centralized clients. Add endpoint-level contract tests first.
3. **Harden queue and office state machines.** Add transactions, row locks, partial unique indexes, position uniqueness, idempotency-key handling, capacity checks, geofence/check-in rules, timeout jobs and scoped staff authorization.
4. **Complete the PostGIS foundation.** Enable the extension and migrate spatial data/indexes before building more positioning or navigation functionality.
5. **Implement real-time through Laravel Reverb/Echo.** Add events, private channel authorization, reconnection behavior and integration tests.
6. **Introduce policies and request objects.** Move role/scope enforcement out of ad hoc controller branches; test 401, 403 and ownership boundaries.
7. **Close documentation and test gaps.** Produce the missing domain docs, decision records, concurrency tests and browser/device E2E coverage.
8. **Only then continue the phased roadmap** with navigation refinement, queues, office ticketing, notifications, AI, staff/admin polish, and mobile finalization.

## Audit conclusion

The project is a meaningful implementation rather than an empty scaffold, and its frontend/mobile presentation and general Laravel foundation are far ahead of a starter project. The correct next feature is not a new screen: it is restoring the backend contract and authoritative architecture around queues, offices, realtime and spatial data.
