# CampusFlow — User Journeys by Role and Platform

Every journey states: **who**, **on what platform**, **with what goal**, and **which endpoint**
carries each step. Where two roles touch the same object, they follow different journeys — there is
no shared "queue page".

Backend paths are relative to `/api/v1`. `role:` guards are listed so a reviewer can confirm the API
matches the journey, not just the UI.

---

## 1. Visitor — Web

**Goal:** decide whether to come, find the place, sign up.

| Step | UI | Endpoint | Guard |
| --- | --- | --- | --- |
| Read landing / value proposition | `/` | static | — |
| Browse public campus overview | `/campus` | `GET /public/overview` | guest |
| View public campus map, buildings, floors | `/campus/map` | `GET /public/buildings`, `GET /public/buildings/{code}` | guest |
| Search public rooms (code, type, building) | `/campus/rooms` | `GET /public/rooms` | guest |
| Inspect a room (public projection only) | `/campus/rooms/[code]` | `GET /public/rooms/{code}` | guest |
| View public map of a floor (no QR anchors, no routing graph) | `/campus/map` | `GET /public/floors/{id}/plan` | guest |
| Browse events / announcements | `/events`, `/announcements` | `GET /public/events`, `GET /public/announcements` | guest |
| Register (student or staff) | `/register` | `POST /auth/register` | guest |
| Sign in | `/login` | `POST /auth/login` → redirect to the role's own dashboard | guest |

**Hard negatives.** A visitor has no route to a dashboard, timetable, queue, ticket, scanner, staff
or admin surface. Requesting any of them returns `401` (unauthenticated) or `403`
(`role:student|staff|admin`), and the web role guard renders "not available on your account" rather
than a disabled control.

**Visitor mobile:** not a product. Public information stays on the web; the mobile app's unauthenticated
state offers only sign-in/register plus a link to the public web site.

---

## 2. Student — Web (planning and information)

**Goal:** understand and plan the academic week, explore campus, keep record of services.

| Step | UI | Endpoint | Guard |
| --- | --- | --- | --- |
| Open role dashboard: today, next classes, active tickets, announcements | `/student/dashboard` | `GET /student/dashboard` | `role:student` |
| Open 7-day timetable, switch week/term | `/student/timetable` | `GET /student/timetable?week=` | `role:student` |
| Inspect a course (lecturer, room, credits, materials link) | `/student/timetable` drawer | `GET /academic/courses/{id}` | scoped by enrolment |
| Click a class → preview route to its room | `/student/campus/rooms/[code]` | `POST /navigation/preview` | `role:student` |
| Explore campus map + floor plan with availability shading | `/student/campus/map` | `GET /floors/{id}/plan` | `role:student` |
| Search rooms by code/building/type/free-now | `/student/campus/rooms` | `GET /rooms?…` | `role:student` |
| Check a room's live queue board (waiting, ETA, open/closed) | `/student/queues` | `GET /queues`, `GET /rooms/{code}/queue` | `role:student` |
| Request a queue ticket from the web (explicit "go to the mobile app to check in" notice) | `/student/queues` dialog | `POST /student/rooms/{room}/queue/join` | `role:student` + `queue.join` |
| Monitor ticket position/ETA; cancel if needed | `/student/queues` | `GET /queue-tickets/{id}`, `POST …/cancel` | owner |
| Read queue history | `/student/queues/history` | `GET /student/queue-tickets` | `role:student` |
| Request / view office ticket + status | `/student/offices` | `POST /student/offices/{office}/tickets` | `role:student` |
| Read office ticket history | `/student/offices/tickets` | `GET /student/office-tickets` | `role:student` |
| Browse events, register | `/student/events` | `GET /public/events`, `POST /events/{id}/register` | `role:student` |
| Read announcements | `/student/announcements` | `GET /public/announcements` | guest data, student chrome |
| Notification inbox, mark read | `/student/notifications` | `GET /me/notifications` | self |
| Ask the assistant; get web-shaped answers (tables + links, no live navigation action) | `/student/assistant` | `POST /ai/chat` (`platform: web`) | `role:student` |
| Edit profile, notification preferences, password | `/student/profile`, `/student/settings` | `PUT /me`, `POST /auth/password` | self |
| Look up an anchor code by hand (no camera; accessibility path) | `/student/locate` | `POST /student/positioning/scan` | `role:student` |

**Deliberately absent from student web:** camera QR scanning as a primary flow, live turn-by-turn
navigation with off-route tracking, continuous GPS writes, check-in by proximity. The links that
would have offered them now read "open the mobile app" — and the API enforces the same boundary.

---

## 3. Student — Mobile (real-time campus companion)

**Goal:** get there, get in, get served, with the phone in one hand.

| Step | Screen | Endpoint | Guard |
| --- | --- | --- | --- |
| Open app → **NEXT CLASS** card: subject, room, countdown, `[ Navigate to B204 ]` | `(student)/tabs/index` | `GET /student/dashboard` (`next_class`) | `role:student` |
| Tap **Scan** (prominent action, camera) → resolve anchor → "You are at B204 · Floor 2" | `(student)/scan` | `POST /student/positioning/scan` | `role:student` |
| Location fix streams while walking | live screens | `POST /positioning/position` | `role:student` (own fix) |
| Live map with self marker + destination | `(student)/tabs/map` | `GET /floors/{id}/plan`, `POST /navigation/route` | `role:student` |
| Turn-by-turn steps, distance, floor changes, recenter, change destination | `(student)/navigate/[code]` | `POST /navigation/sessions`, `POST …/position` | `role:student` |
| Off-route → warning → auto recalculation | same | `PATCH /navigation/sessions/{id}` | owner |
| Arrive → complete navigation | same | `POST …/complete` | owner |
| Search room → availability → **Join queue** | `(student)/rooms` → `room/[code]` | `GET /rooms`, `POST /student/rooms/{room}/queue/join` | `role:student` |
| Live ticket: position, people ahead, ETA, countdown, `[ Check in ]` when in range | `(student)/tabs/queue` | `GET /queue-tickets/{id}`, `POST …/proximity-check`, `POST …/check-in` | owner |
| Push: "You're 2nd in line" / "It's your turn" | notification | broadcast on `queue:{id}` + push token | subscriber |
| Tap alert → navigate to room | deep link | `POST /navigation/route` | `role:student` |
| Office: pick service → ticket → position → "your turn" → navigate → check in | `(student)/tabs/office`, `office/[code]` | `POST /student/offices/{office}/tickets`, `GET /office-tickets/{id}`, `POST …/check-in` | `role:student` |
| Ask assistant "navigate me to B204" → the assistant **starts** the navigation workflow | `(student)/assistant` | `POST /ai/chat` (`platform: mobile`) → `start_navigation` action | `role:student` + `navigation.live` |

**Optimised for:** walking, one thumb, camera, GPS, bursty connectivity, push.
**Not present:** week grid, admin tables, configuration panels, other people's data, floor-plan editing.

---

## 4. Staff — Web (operations console)

**Goal:** keep the line moving and keep campus data correct.

| Step | UI | Endpoint | Guard |
| --- | --- | --- | --- |
| Open operations dashboard: queues I serve, waiting counts, longest wait, no-shows, windows open | `/staff/dashboard` | `GET /staff/dashboard` | `role:staff,admin` + `queue.operate.assigned` |
| Open a queue → sortable line table (position, name, reg no, status, waited, joined via) | `/staff/queues/[id]` | `GET /staff/queues/{id}/line` | assigned scope |
| **Call next** | same | `POST /staff/queues/{id}/call-next` | assigned scope |
| Call a specific ticket | same | `POST /staff/queue-tickets/{id}/call` | assigned scope |
| Verify identity (student shows code / staff searches reg no) | same | `GET /staff/students/{regNo}` | `role:staff` |
| Mark checked in / admit | same | `POST /staff/queue-tickets/{id}/admit` | assigned scope |
| Mark no-show, recall, cancel | same | `POST /staff/queue-tickets/{id}/no-show` | assigned scope |
| Complete / release seat (decrements occupancy) | same | `POST /staff/queue-tickets/{id}/complete` | assigned scope |
| Open office service → waiting list + in-service + window state | `/staff/offices/[id]` | `GET /staff/offices/{id}/line` | assigned scope |
| Office: call next → start service → complete → no-show | same | `POST /staff/office-tickets/{id}/call-next|start-service|complete|no-show` | assigned scope |
| Manage my teaching timetable (create/edit/cancel entries, publish) | `/staff/timetable` | `GET|POST|PATCH|DELETE /staff/timetable` | `timetable.manage.assigned` |
| Create/edit events and announcements | `/staff/content` | `POST|PATCH /staff/events`, `/staff/announcements` | `content.publish` |
| Operational analytics for the queues/offices I run | `/staff/analytics` | `GET /staff/analytics` | `analytics.operational` |
| Notifications, profile | `/staff/notifications`, `/staff/profile` | `GET /me/notifications` | self |
| Ask assistant "how many students are waiting?" → authorized statistics only | `/staff/assistant` | `POST /ai/chat` | `ai.assistant.operations` |

**Absent for staff:** joining a queue, taking a ticket, student QR workflow, student indoor
navigation, student personal-timetable UX, campus public-browse chrome, and every admin surface
(users, spatial editing, service configuration, audit).

---

## 5. Staff — Mobile (limited operational companion)

**Goal:** act on the line without being at a desk.

| Step | Screen | Endpoint | Guard |
| --- | --- | --- | --- |
| Open → today's queue at a glance (waiting, called, served, no-shows) | `(staff)/tabs/index` | `GET /staff/dashboard?scope=today` | `role:staff,admin` |
| **Call next** (one tap, haptic + row highlight) | `(staff)/tabs/queue` | `POST /staff/queues/{id}/call-next` | assigned |
| Check in a student who is standing there | same | `POST /staff/queue-tickets/{id}/admit` | assigned |
| No-show / start service / complete service | same | `…/no-show`, `…/start-service`, `…/complete` | assigned |
| Office line quick actions | `(staff)/tabs/office` | `POST /staff/offices/{id}/call-next` | assigned |
| Important alerts (window closed, queue over capacity, low-staffed office) | `(staff)/tabs/alerts` | `GET /me/notifications?priority=high` | self |

**Present:** status + six verbs. **Absent:** scanning, navigation, joining queues, requesting tickets,
configuration, analytics tables, user management. Full management stays on Web by design.

---

## 6. Admin — Web (full management environment)

**Goal:** configure and assure the platform.

| Step | UI | Endpoint | Guard |
| --- | --- | --- | --- |
| System dashboard: health, active queues, today's volume, open incidents, utilisation, recent audit | `/admin/dashboard` | `GET /admin/dashboard` | `role:admin` |
| Users: search, create, edit, disable, reset password, change role | `/admin/users` | `GET|POST|PATCH /admin/users`, `…/reset-password` | `users.manage` |
| Roles & permissions: assign, revoke, view effective access | `/admin/roles` | `GET|PATCH /admin/roles` | `users.manage` |
| Buildings CRUD (name, code, address, geometry, status) | `/admin/campus/buildings` | `GET|POST|PATCH|DELETE /admin/buildings` | `rooms.manage` |
| Floors CRUD (level, name, elevation, plan reference) | `/admin/campus/floors` | `/admin/floors` | `rooms.manage` |
| Rooms CRUD (capacity, type, accessibility, access rules, availability rules) | `/admin/campus/rooms` | `/admin/rooms` | `rooms.manage` |
| Floor-plan editor (upload/trace, scale, place rooms) | `/admin/campus/plans/[floorId]` | `PUT /admin/floors/{id}/plan` | `spatial.manage` |
| QR node management (create, bind to room/floor, coordinates, payload, revoke, regenerate) | `/admin/spatial/qr-nodes` | `/admin/qr-nodes` | `spatial.manage` |
| Navigation graph editor (nodes, edges, distance, indoor/outdoor, accessible-only, enable/disable) | `/admin/spatial/navigation` | `/admin/navigation-nodes`, `/admin/navigation-edges` | `spatial.manage` |
| Geofence editor (perimeter, entry/exit radius, dwell) | `/admin/spatial/geofences` | `/admin/geofences` | `spatial.manage` |
| Queue configuration (open/close, capacity, proximity radius, timeout, grace, duplicate rule, avg service time) | `/admin/queues` | `/admin/queues`, `POST /admin/rooms/{id}/queue` | `queue.configure` |
| Office configuration (location, hours, capacity, service duration, ticket prefix, check-in rules) | `/admin/offices` | `/admin/offices` | `office.configure` |
| Service windows + staff assignment | `/admin/offices/[id]` | `/admin/office-service-windows`, `/admin/office-staff` | `office.configure` |
| Analytics (utilisation, queue volume, wait times, office activity, no-show rate, system usage) | `/admin/analytics` | `GET /admin/analytics` | `analytics.system` |
| Audit log with filters | `/admin/audit` | `GET /admin/audit-logs` | `audit.view` |
| Settings / feature flags | `/admin/settings` | `GET|POST /admin/settings` | `role:admin` |
| Assistant for administrative questions (counts, configuration help) | `/admin/assistant` | `POST /ai/chat` | `ai.assistant.administration` |

---

## 7. Admin — Mobile (monitoring only)

**Goal:** know when something is wrong and prove it was seen.

| Step | Screen | Endpoint | Guard |
| --- | --- | --- | --- |
| Open → critical alerts (queue over capacity, office window closed unexpectedly, scan failures, API/DB degraded) | `(admin)/tabs/index` | `GET /admin/alerts` | `role:admin` |
| Key figures for today (active queues, tickets issued, median wait, no-show rate) | same | `GET /admin/monitoring/summary` | `role:admin` |
| Drill into one queue's live state (read-only) | `(admin)/queue/[id]` | `GET /admin/queues/{id}` | `role:admin` |
| Acknowledge an alert | same | `POST /admin/alerts/{id}/ack` | `role:admin` |

**Absent by design:** creating a building, editing a floor plan, editing the navigation graph,
configuring a geofence, managing users, publishing timetables, all complex forms. The mobile client
does not even register those routes; the API rejects them from a mobile context where a rule is
platform-narrowed.

---

## 8. Cross-role journeys: the same object, three workflows

### Room queue

| | Student | Staff | Admin |
| --- | --- | --- | --- |
| Question | "Where am I in the queue?" | "Who do I call next?" | "Is the policy right?" |
| Journey | search → view room → eligibility → join → ticket → monitor → notify → navigate → check in | open queue → line → call next → monitor check-in → no-show → admit → complete | configure capacity/radius/timeout/grace/duplicates → monitor analytics |
| Platform | mobile primary, web for status/history | web primary, mobile for the six verbs | web only |
| Endpoints | `POST /student/rooms/{room}/queue/join` | `POST /staff/queues/{id}/call-next` | `PATCH /admin/queues/{id}` |
| UI | countdown card, position ring, `[Check in]` | dense table, row actions | form + policy fields + charts |

### Administrative office

| | Student | Staff | Admin |
| --- | --- | --- | --- |
| Question | "When is my turn?" | "Next, please." | "Is the office configured and staffed?" |
| Journey | view office → request ticket → position → approaching → your turn → navigate → check in → served | view line → call next → verify → start service → complete → no-show | office → hours → capacity → duration → staff assignment → ticket rules → analytics |
| Platform | mobile primary | web primary | web only |
| Endpoints | `POST /student/offices/{office}/tickets` | `POST /staff/office-tickets/{id}/start-service` | `POST /admin/offices` |

### Timetable

| | Student | Staff | Admin |
| --- | --- | --- | --- |
| Question | "What's next?" | "What am I teaching?" | "Does the schedule conflict?" |
| Journey | dashboard → today/week → course detail → navigate | my entries → create/edit → publish | all entries → conflict resolution → term management |
| Platform | mobile card + web grid | web editor | web administration |
| Endpoints | `GET /student/timetable` | `POST /staff/timetable` | `GET /admin/timetable` |

### Map / spatial

| | Student | Staff | Admin |
| --- | --- | --- | --- |
| Question | "Where is it and how do I get there?" | "Which rooms are busy?" | "Is the routing graph correct?" |
| Journey | map → locate (scan) → route → live steps | operational map with occupancy | nodes/edges/plans/geofences/QR issuance |
| Platform | mobile primary | web where useful | web only |
| Endpoints | `POST /navigation/route` | `GET /floors/{id}/availability` | `POST /admin/navigation-edges` |

### AI assistant (one engine, different affordances)

| Context | Utterance | Authorized action offered |
| --- | --- | --- |
| Student × Mobile | "Navigate me to B204" | `start_navigation` → opens live navigation screen |
| Student × Web | "Where is B204?" | `show_room` + `show_map` → room detail with route preview |
| Staff × Web | "How many students are waiting?" | `queue_statistics` scoped to assigned queues |
| Staff × Mobile | "Call the next student" | `call_next` with confirm sheet |
| Admin × Web | "How many active queues are there?" | `system_analytics` |
| Admin × Mobile | "Any queues over capacity?" | `alert_summary` (read-only) |
| Any ✕ attempt | Student asks "create a building" | refused: `permission_denied`, no tool call is made |
