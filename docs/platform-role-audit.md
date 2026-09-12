# CampusFlow — Platform & Role Audit

**Audit date:** 2026-09-12
**Trigger:** architectural correction directive — "role + platform + workflow" must govern every feature.
**Scope:** read-only inspection of `backend/`, `frontend/`, `mobile/` at commit `661e514`. Every finding
below is backed by a file and line that was actually read; nothing here is inferred from filenames.

---

## 0. Verdict

The repository violates the platform/role separation rule at the **architecture layer**, not at the
button layer. The backend, the web client and the mobile client each present one universal
experience to every authenticated human, and authorization is applied inconsistently and only
after the route has already been reached.

| Dimension | Reality in the code | Verdict |
| --- | --- | --- |
| Role model | `visitor / student / staff / admin` string on `users.role`; role helpers exist on the model | Present but under-enforced |
| Backend authorization | No middleware directory, no policies, no gates. Three ad-hoc controller guards only | **Fails** |
| Web navigation | One nav array that *concatenates* student, staff and admin items | **Fails** |
| Web routes | Flat, role-neutral namespace (`/dashboard`, `/queue`, `/scan`, `/admin/*`) | **Fails** |
| Dashboards | One `GET /me/dashboard` payload with `if isStudent / elseif isStaff` branches | **Fails** |
| Mobile navigation | One five-tab shell for every role; a generic "More" list for everyone | **Fails** |
| Web vs mobile | Mobile is a smaller copy of the same screens, not a different product | **Fails** |
| AI assistant | Keyword bot, role-blind, and it emits **web** routes to the **mobile** client | **Fails** |
| Visitor surface | Landing + `/status` only; the public map/rooms/events the spec requires do not exist as public screens | **Incomplete** |
| Tests | 13 feature files, **zero** `401`/`403` assertions anywhere in `backend/tests` | **Missing** |

Because the separation is broken at the root, this audit is accompanied by a correction (see §9)
rather than by new feature work.

---

## 1. Features currently exposed to all users

| # | Feature | Evidence | Why it is wrong |
| --- | --- | --- | --- |
| 1.1 | Universal navigation menu | `frontend/components/layout/app-shell.tsx:68-70` — `const items = [...STUDENT_NAV]; if (isStaff) items.splice(1, 0, ...STAFF_NAV); if (isAdmin) items.push(...ADMIN_NAV);` | Admins and staff receive the *student* menu; admins receive all 21 items. Prohibited by "do NOT create one universal navigation menu". |
| 1.2 | Universal dashboard | `frontend/app/(app)/dashboard/page.tsx:21` (`meApi.dashboard()`), `backend/app/Http/Controllers/MeController.php:24-80` | One payload for everyone; role handled by internal `if`. Prohibited by the dashboard rule (`StudentDashboard` / `StaffDashboard` / `AdminDashboard`). |
| 1.3 | Universal route namespace | `frontend/app/(app)/*` — `dashboard`, `timetable`, `map`, `navigate`, `rooms`, `queue`, `offices`, `scan`, `assistant`, `events`, `notifications`, `profile` | These are *student* workflows reachable by every role with no role gate at the route level. |
| 1.4 | QR scanning on web for everyone | `frontend/components/layout/app-shell.tsx:199` — `href="/scan"` rendered unconditionally in the top bar; `frontend/app/(app)/scan/page.tsx` | Scanner is a primary mobile student capability. On web it must not be a primary feature, and it must not exist for visitors. |
| 1.5 | Public, unauthenticated QR anchor scan | `backend/routes/api.php:76` — `Route::post('/positioning/scan', …)` sits **outside** the `auth:sanctum` group | Anyone can resolve anchor payloads and mint location fixes. |
| 1.6 | Universal mobile shell | `mobile/src/app/(tabs)/_layout.tsx` (Home, Timetable, Map, Queue, More) + `mobile/src/app/(tabs)/more.tsx:11-17` | Staff and admins signing in on mobile get the student app, including student queue joining and student navigation. |
| 1.7 | Universal AI assistant suggestions | `backend/app/Http/Controllers/AiAssistantController.php:85-118` | Same hardcoded routes (`/offices`, `/map`, `/timetable`) for every role and both platforms. |
| 1.8 | `GET /academic/timetable` | `backend/routes/api.php:135-136` | Only `auth:sanctum`; no ownership/role scoping on the enrollment mutation `POST /academic/enrollments`. |

## 2. Features incorrectly exposed to the wrong role

| # | Exposure | Evidence | Required behaviour |
| --- | --- | --- | --- |
| 2.1 | **Any** authenticated user may join a room queue | `backend/app/Http/Controllers/QueueController.php:56-60` — `join()` never inspects `$user->role` | `POST /student/queues/{room}/join` guarded by `role:student` → staff/admin get **403** |
| 2.2 | **Any** authenticated user may request an office ticket | `backend/routes/api.php:126` (`POST /offices/{office}/tickets`) — the controller checks nothing | Student-only request flow |
| 2.3 | Staff menu is *additive* to the student menu | `app-shell.tsx:69` (`splice`) | Staff Web is an operations console; it must not carry student timetable/queue-joining screens |
| 2.4 | Admin receives the student nav **and** the staff nav | `app-shell.tsx:70` (`push`) | Admin Web is management/configuration, not a superset |
| 2.5 | Admin can act as staff through one shared guard | `backend/app/Http/Controllers/StaffController.php:26-29` — `in_array($role, ['staff','admin'])` | Admin-as-staff must be an explicit, documented delegation, not an accident of the guard |
| 2.6 | Visitor-role accounts can reach every authenticated screen | `frontend/app/(app)/layout.tsx:8` — `useRequireAuth()` with no role argument | Visitors get public screens only |
| 2.7 | Student web exposes management-shaped screens to students | `frontend/app/(app)/offices/*`, `queue`, `scan` | Student web = view/status/request; real-time action = mobile |
| 2.8 | `useRequireAuth(roles)` silently promotes admins | `frontend/lib/auth/auth-context.tsx:150` — `&& !isAdmin` | An admin-only escape hatch on a *student* guard is a bypass; role trees must be explicit |

## 3. Web features that should be mobile-only

| Feature | Current location | Correction |
| --- | --- | --- |
| Camera QR scanning | `frontend/app/(app)/scan/page.tsx` (`getUserMedia` + `jsqr`) | Mobile-only `scan` screen. Web keeps a non-camera *anchor-code lookup* for accessibility, off the primary path and absent from the nav. |
| Live navigation with off-route tracking | `frontend/app/(app)/navigate/page.tsx` | Mobile is the primary live-tracking surface. Web keeps route **planning/preview** only. |
| Continuous position updates | `positioningApi.update` used from web pages | Mobile-only writer; web is read-only for location. |
| Queue check-in by proximity | `frontend/app/(app)/queue/page.tsx` | Check-in requires device location → mobile. Web shows status and history. |
| Push notifications | n/a on web | Mobile push; web uses in-app notification centre only. |

## 4. Mobile features that should be web-only

The mobile client currently reaches student web surfaces that are *planning* surfaces; the reverse
direction (management on mobile) is not implemented, which is correct — but two items need
enforcement so they can never be added by accident:

| Feature | Note | Correction |
| --- | --- | --- |
| Detailed week-grid timetable | `mobile/src/app/(tabs)/timetable.tsx` shows the full week grid | Mobile keeps *today / next class*; the seven-day grid belongs to web |
| Long-form AI conversation | `mobile/src/app/assistant.tsx` | Acceptable, but actions must be mobile actions (start navigation), never web routes |
| *(prohibited additions)* | Room/queue/office configuration, user management, floor-plan editing, navigation-graph editing | Documented as **Admin Web / Staff Web only**; a static guard test now fails the build if a management screen is added under `mobile/` |

## 5. Features that must exist on both platforms with different workflows

| Capability | Web workflow | Mobile workflow |
| --- | --- | --- |
| Room queue | Read-only availability board, queue history, request/cancel with a confirmation dialog on a wide table | Live ticket: position, people ahead, ETA, countdown, notifications, check in, navigate to room |
| Office ticketing | Office directory, service window table, ticket history and status | Request ticket, position, approaching/"your turn" alerts, walk-to-office navigation, check in |
| Timetable | Seven-day grid, course inspection, room links, term switcher | "Next class" card + start navigation |
| Campus map | Explore, filter, floor plan with details panel | Located, full-bleed map with user marker and destination sheet |
| AI assistant | Rich answers, tables, links to detail pages, management queries for staff/admin | One-tap actions that mutate state (start navigation, join queue) with confirmation |
| Notifications | Full inbox with filters, mark all read | Push + a compact, action-bearing list |

## 6. Generic dashboards that need separation

`GET /me/dashboard` (`MeController.php:24`) returns the same shape for every role and the client
decides what to do with it. It is replaced by three authoritative endpoints with three payloads:

- `GET /api/v1/student/dashboard` — academic + campus activity (today, next class, active tickets, announcements).
- `GET /api/v1/staff/dashboard` — operational (queues I serve, lines, who to call, no-shows, service windows).
- `GET /api/v1/admin/dashboard` — system/infrastructure (health, utilisation, queue volume, alerts, audit).

## 7. Generic navigation menus that need separation

`STUDENT_NAV` / `STAFF_NAV` / `ADMIN_NAV` are concatenated in `app-shell.tsx`. They become three
independent navigation models owned by three shells (`StudentWebShell`, `StaffWebShell`,
`AdminWebShell`), each rendering only its own routes. `isStaff`/`isAdmin` flags used to *extend* a
menu are removed from the client.

## 8. APIs needing role-specific authorization

| Endpoint today | Gap | Target |
| --- | --- | --- |
| `POST /positioning/scan` | public | `POST /student/positioning/scan`, `auth:sanctum` + `role:student` |
| `POST /rooms/{room}/queue/join` | no role check in controller | `POST /student/rooms/{room}/queue/join` + `role:student` |
| `POST /offices/{office}/tickets` | no role check | `POST /student/offices/{office}/tickets` + `role:student` |
| `POST /queue/tickets/{t}/call|admit|leave` | duplicated staff actions outside the staff prefix | `POST /staff/queue-tickets/{t}/…` with `QueueTicket` policy |
| `POST /offices/tickets/{t}/call|complete` | same | `POST /staff/office-tickets/{t}/…` with `OfficeTicket` policy |
| `GET /me/dashboard` | universal | three role dashboards |
| `GET /me/*`, `GET /academic/timetable` | student data served to any role | `GET /student/timetable` + `role:student` |
| `POST /academic/enrollments` | no authorization | `POST /admin/enrollments` + policy |
| `GET /navigation/nodes`, `/edges` | public read of the full routing graph | `role:admin` (or staff where scoped) |
| `GET /rooms`, `/buildings`, `/floors/{f}/plan` | public read of *everything*, including QR nodes and nav graph on the plan payload | public **projection** endpoint (`/public/*`) that omits non-public fields; full payloads behind `role:` |
| `PUT /me`, `POST /me/devices` | fine (self-scoped) | unchanged, still requires auth |

Missing infrastructure found: no `app/Http/Middleware/`, no `app/Policies/`, no `Gate::define`
anywhere, and `bootstrap/app.php:19-21` registers **no** middleware aliases.

## 9. Incorrectly shared components / screens to redesign

| Item | Verdict |
| --- | --- |
| `components/ui/kit.tsx`, `mobile/src/components/ui.tsx`, `components/maps/*`, `admin/table.tsx`, `toast` | **Correctly shared** — presentational primitives |
| `app-shell.tsx` | **Incorrectly shared** — one shell for three roles → split |
| `(app)/queue/page.tsx` (student join) vs `staff/queues/[id]/page.tsx` (call-next) | Correctly separate; the student one just moved under `/student/*` |
| `(app)/offices/*` vs `staff/offices/[id]/*` | Correctly separate |
| `mobile/(tabs)/index.tsx` (student "Hi {name}" + next class) | Must not be the staff/admin home → split into role tab groups |
| `mobile/(tabs)/more.tsx` | Generic feature list for every role → deleted; replaced by role tabs |
| `lib/api/endpoints.ts` + `mobile/src/lib/api.ts` | Clients call role-neutral paths → each client now calls its role's domain and *never* another role's |

---

## 10. Correction applied in this change set

1. **Contract** — `docs/role-platform-matrix.md` (every feature × role × platform decision) and
   `docs/user-journeys.md` (workflow per role per platform) are now mandatory reading before a
   screen is added.
2. **Backend** — `EnsureRole` + `ResolveClientContext` middleware, `Gate`/policy layer
   (`CampusInfrastructure`, `RoomQueue`, `QueueTicket`, `Office`, `OfficeTicket`, `UserManagement`),
   role-scoped route domains (`/public/*`, `/student/*`, `/staff/*`, `/admin/*`, `/me/*`), and three
   separate dashboard endpoints.
3. **Web** — role route trees `(public)`, `(student)`, `(staff)`, `(admin)` with three independent
   shells and navigation models; management surfaces removed from the student tree; scanning and
   live tracking demoted to their correct platform.
4. **Mobile** — student-first tab group (next class, live map, navigate, queue, office, scan),
   a limited staff operations group (queue, call next, check in, no-show, start/complete), and an
   admin monitoring/alert group. The generic "More" menu is gone.
5. **AI** — the assistant receives `role`, `platform`, `permissions` and current context; its tool
   allow-list and the actions it offers are filtered by all three, and mobile actions resolve to
   mobile routes.
6. **Tests** — role/platform authorization matrix tests (`RoleAccessTest`,
   `PlatformCapabilityTest`, `VisitorSurfaceTest`) plus a runnable static guard
   (`scripts/check-role-separation.mjs`) that fails when a universal nav, a cross-role screen, or a
   management screen in mobile reappears.

## 11. Honest status of the correction

- The static separation guard and TypeScript/lint gates are executable in this sandbox; the Laravel
  suite is **not** (no PHP runtime, no PostgreSQL instance), so the new PHP tests are written to the
  existing `RefreshDatabase` conventions but have not been executed here. They must run in CI before
  this correction is called complete.
- Old flat routes (`/dashboard`, `/queue`, …) redirect to their role-scoped equivalents so no
  bookmark or in-flight link 404s; the redirect table is temporary and listed in
  `frontend/next.config.ts`.
- `docs/implementation-audit.md` items 2–4 (queue safety, PostGIS, realtime) remain open and are
  **not** addressed by this change set; this document covers role/platform separation only.
