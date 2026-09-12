# CampusFlow — Role × Platform × Feature Matrix

**Status: authoritative contract.** Every feature in CampusFlow must have a row here before it is
implemented. If a feature is not in this matrix, it does not ship. If the implementation disagrees
with this matrix, the implementation is wrong.

Accompanying documents: [`platform-role-audit.md`](platform-role-audit.md) (what was broken),
[`user-journeys.md`](user-journeys.md) (how each role moves through each feature).

---

## 0. Rules this matrix enforces

1. **Role + platform + context** decide access. Never role alone, never "everyone gets it".
2. The **backend** is the authority. A missing menu entry is presentation; a missing `role:` /
   policy check is a security defect.
3. **Web** = plan, manage, analyse, configure. **Mobile** = move, scan, interact, check in, react.
4. Two platforms having a feature **never** means one screen. Same data, different workflow.
5. No universal dashboard, no universal navigation, no universal feature list.

### Legend

| Symbol | Meaning |
| --- | --- |
| ● | **Primary** — the defining surface for this feature; built for it, in its navigation |
| ○ | **Available** — supported, but deliberately lighter / secondary / non-promoted |
| ◐ | **Read-only** — view and inspect, no mutation |
| ✕ | **Not available** — absent from navigation *and* rejected by the API with `403` |
| ⚙ | **Configuration only** — admin/authoring surface, no end-user workflow |

---

## 1. Master matrix

| Feature | Visitor Web | Student Web | Student Mobile | Staff Web | Staff Mobile | Admin Web | Admin Mobile |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Landing / marketing | ● | ○ | ○ | ○ | ○ | ○ | ○ |
| Login / register / forgot password | ● | ● | ● | ● | ● | ● | ● |
| Authenticated app access | ✕ | ● | ● | ● | ● | ● | ○ |
| Dashboard (role-specific) | ✕ | ● academic | ● next-class live | ● operations | ● queue at a glance | ● system analytics | ○ alerts summary |
| Timetable — 7-day grid, course detail | ✕ | ● | ○ today only | ● teaching schedule | ○ today only | ◐ all timetables | ✕ |
| Timetable authoring / publish | ✕ | ✕ | ✕ | ● where assigned | ✕ | ● | ✕ |
| Courses / enrolment self-service | ✕ | ● view | ○ view | ◐ class list | ✕ | ● manage enrolments | ✕ |
| Campus map — explore | ○ public | ● | ● located | ● operational | ○ | ● spatial mgmt | ◐ |
| Campus map — building/facility info | ● | ● | ● | ● | ○ | ◐ | ◐ |
| Room search & availability | ● public subset | ● | ● | ● | ○ | ● manage | ✕ |
| Room detail (capacity, equipment, floor) | ◐ public projection | ● | ● | ● | ○ | ● | ✕ |
| QR scanning (camera) | ✕ | ✕ (not primary) | ● | ✕ | ✕ | ✕ (admin uses node list) | ✕ |
| QR anchor code lookup (manual, no camera) | ✕ | ○ accessibility fallback | ○ | ✕ | ✕ | ✕ | ✕ |
| Indoor positioning (live fix) | ✕ | ◐ where position came from | ● | ✕ | ✕ | ⚙ node/anchor config | ✕ |
| Route planning / preview (A→B) | ○ public route | ● | ● | ○ | ✕ | ⚙ graph inspection | ✕ |
| Live turn-by-turn navigation | ✕ | ○ preview only | ● | ✕ | ✕ | ✕ | ✕ |
| Off-route detection & recalculation | ✕ | ✕ | ● | ✕ | ✕ | ✕ | ✕ |
| Navigation graph editing (nodes/edges/floors) | ✕ | ✕ | ✕ | ✕ | ✕ | ● | ✕ |
| Geofence editor | ✕ | ✕ | ✕ | ✕ | ✕ | ● | ✕ |
| Room queue — view live status | ✕ | ● board | ● | ● | ● | ◐ | ◐ |
| Room queue — join / take ticket | ✕ | ○ request | ● | ✕ (staff never queues) | ✕ | ✕ | ✕ |
| Room queue — position / ETA / countdown | ✕ | ○ | ● | ○ context for the line | ○ | ◐ | ◐ |
| Room queue — call next / admit / no-show / complete | ✕ | ✕ | ✕ | ● | ● quick actions | ⚙ policy only | ○ call-next only if delegated |
| Room queue — configuration (capacity, radius, timeout, grace, duplicates) | ✕ | ✕ | ✕ | ○ per assigned queue where allowed | ✕ | ● | ✕ |
| Check-in (queue / office) | ✕ | ○ | ● | ● verify + manual | ● | ⚙ rules | ✕ |
| Office directory / services / hours | ○ public | ● | ● | ● | ○ | ● manage | ◐ |
| Office ticket — request | ✕ | ○ request | ● | ✕ | ✕ | ✕ | ✕ |
| Office ticket — position, approaching, "your turn" | ✕ | ○ | ● | ● the line | ● | ◐ | ○ alerts |
| Office ticket — call / start service / complete / no-show | ✕ | ✕ | ✕ | ● | ● | ⚙ rules | ✕ |
| Office configuration (windows, prefix, duration, capacity, staff assignment) | ✕ | ✕ | ✕ | ✕ | ✕ | ● | ✕ |
| Queue / ticket history (own) | ✕ | ● | ○ recent | ● served | ○ today | ● system-wide | ◐ |
| Events — browse | ● public | ● | ○ | ● | ○ | ◐ | ✕ |
| Events — create/edit/publish | ✕ | ✕ | ✕ | ● | ✕ | ● | ✕ |
| Event registration | ✕ | ● | ○ | ◐ roster | ✕ | ◐ | ✕ |
| Announcements — read | ● public | ● | ● | ● | ● | ● | ● |
| Announcements — author/publish | ✕ | ✕ | ✕ | ● | ✕ | ● | ✕ |
| Notifications — in-app centre | ✕ | ● | ● | ● | ● | ● | ● |
| Push notifications | ✕ | ○ browser (optional, not built) | ● | ○ | ● operational | ○ | ● critical alerts |
| AI Campus Assistant | ○ public facts | ● rich Q&A | ● action-first | ● operations Q&A | ○ scoped quick answers | ● admin/analytics Q&A | ○ read-only summaries |
| Profile & account settings | ✕ | ● | ● | ● | ● | ● | ○ |
| Appearance / notification preferences | ✕ | ● | ● | ● | ● | ● | ○ |
| User management (create, disable, roles) | ✕ | ✕ | ✕ | ✕ | ✕ | ● | ✕ |
| Roles & permissions management | ✕ | ✕ | ✕ | ✕ | ✕ | ● | ✕ |
| Buildings / floors / rooms management | ✕ | ✕ | ✕ | ○ rooms where assigned | ✕ | ● | ✕ |
| Floor-plan editor | ✕ | ✕ | ✕ | ✕ | ✕ | ● | ✕ |
| QR node management (issue, revoke, regenerate) | ✕ | ✕ | ✕ | ✕ | ✕ | ● | ✕ |
| Analytics — utilisation, volume, wait, no-show | ✕ | ○ personal only | ✕ | ● operational | ○ today | ● system-wide | ○ key figures |
| Audit log | ✕ | ✕ | ✕ | ✕ | ✕ | ● | ✕ |
| Settings / feature flags | ✕ | ✕ | ✕ | ✕ | ✕ | ● | ✕ |
| Service status page | ● | ● | ● | ● | ● | ● | ● |

**Row count: 48 explicit decisions.** `✕` in a column means both "no navigation entry" **and**
"API returns 403" — the second half is enforced in `backend/routes/api.php` and the policies, not in
the client.

---

## 2. Role definitions

| Role | Responsibility | Primary platform | Secondary platform | What they must never see |
| --- | --- | --- | --- | --- |
| **Visitor** | Decide whether/when to come to campus; find public information | Web | (mobile public viewer is optional and not implemented) | Any private navigation, any queue action, any ticket, any management surface |
| **Student** | Attend class, reach rooms, get served without wasting time in lines | **Mobile** for anything physical; Web for planning | Web | Staff operations, admin configuration, other people's data |
| **Staff** | Run queues, serve students, keep timetable/events/content correct | Web (operations console) | Mobile (quick operational actions only) | Student queue-joining, student navigation, campus personal-timetable UX, infrastructure editing |
| **Admin** | Configure and monitor the platform: spaces, spatial graph, services, users, policies | Web (full management) | Mobile (monitoring & critical alerts only) | Complex configuration on mobile; student/staff end-user workflows |

## 3. Platform purpose

| | Web | Mobile |
| --- | --- | --- |
| One-line purpose | Plan, manage, analyse, configure | Move, interact, navigate, check in, react |
| Optimised for | information density, tables, editors, charts, filters, split views | one hand, walking, camera, GPS, transient connectivity, push, quick action |
| Default interaction | read → compare → configure | glance → tap → confirm → act |
| Never | camera scanning as a primary flow; live turn-by-turn driving the UI; full configuration on a phone | a shrunken web dashboard; admin CRUD; floor-plan editing |
| Layout primitives that belong here | data tables, split panes, map/graph editors, advanced filters, multi-week grids | large cards, sticky action bars, tab bars, bottom sheets, countdowns, status pills |

## 4. Authorization model (backend contract)

```
access(role, platform, feature, resource) =
      authenticated
  AND role ∈ Feature.allowed_roles
  AND permission ∈ Role.permissions(feature)
  AND policy(allows(role, action, resource))        ← resource ownership / staff assignment scope
  AND business_rule(allows(feature, context))        ← capacity, geofence, state machine, idempotency
  AND (platform ∉ Feature.forbidden_platforms)        ← platform may only NARROW access
```

Platform is a **narrowing** dimension only: a device header can remove capabilities from a request
(e.g. a web client may not open a camera-scan session), it can never grant one. Identity always
comes from the Sanctum token, never from a client-supplied role.

### Routes are role-scoped, not shared-and-filtered

| Domain | Guard | Notes |
| --- | --- | --- |
| `/api/v1/public/*` | none (guest allowed) | Projection endpoints only; private fields stripped |
| `/api/v1/auth/*`, `/me/*` | `auth:sanctum` | Self-scoped identity, profile, devices, notification reads |
| `/api/v1/student/*` | `auth:sanctum` + `role:student` | timetable, dashboard, queue join, office ticket, positioning |
| `/api/v1/staff/*` | `auth:sanctum` + `role:staff,admin` | queue/office operations, timetable authoring, content |
| `/api/v1/admin/*` | `auth:sanctum` + `role:admin` | infrastructure, spatial, services, users, analytics |
| `/api/v1/ai/*` | `auth:sanctum` | one gateway; tool allow-list filtered by role + platform + permissions |

## 5. Permission registry

Roles hold permission strings; the matrix above is generated from them, not the reverse.

| Permission | student | staff | admin | Grants |
| --- | --- | --- | --- | --- |
| `timetable.view.own` | ● | ● | ● | own schedule only |
| `timetable.manage.assigned` | ✕ | ● | ● | entries where lecturer/assigned |
| `timetable.manage.all` | ✕ | ✕ | ● | any entry |
| `campus.view.public` | ● | ● | ● | buildings/floors/rooms projection |
| `campus.view.private` | ● | ● | ● | plus availability, occupancy, class links |
| `rooms.manage` | ✕ | ✕ | ● | CRUD rooms/floors/buildings |
| `spatial.manage` | ✕ | ✕ | ● | nodes, edges, QR anchors, geofences, plans |
| `spatial.view` | ● | ● | ● | read graph for routing/inspection |
| `positioning.update.own` | ● | ✕ | ✕ | write own live fix (mobile) |
| `navigation.live` | ● | ✕ | ✕ | start/update/end navigation sessions |
| `navigation.preview` | ● | ● | ● | compute a route |
| `queue.join` | ● | ✕ | ✕ | take a room-queue ticket |
| `queue.view` | ● | ● | ● | queue status (scoped) |
| `queue.operate.assigned` | ✕ | ● | ● | call/admit/complete/no-show for assigned queues |
| `queue.configure` | ✕ | ○ policy fields | ● | capacity, radius, timeout, grace, duplicate rule |
| `office.ticket.request` | ● | ✕ | ✕ | request office ticket |
| `office.ticket.view.own` | ● | ● | ● | own tickets |
| `office.operate.assigned` | ✕ | ● | ● | call/start/complete/no-show |
| `office.configure` | ✕ | ✕ | ● | windows, prefix, duration, assignment, hours |
| `content.manage.own_scope` | ✕ | ● | ● | events/announcements authored by/for scope |
| `content.publish` | ✕ | ● | ● | publish |
| `users.manage` | ✕ | ✕ | ● | create/disable/re-role users |
| `analytics.operational` | ✕ | ● | ● | queues/offices they serve |
| `analytics.system` | ✕ | ✕ | ● | campus-wide |
| `audit.view` | ✕ | ✕ | ● | audit log |
| `ai.assistant.basic` | ● | ● | ● | campus Q&A |
| `ai.assistant.operations` | ✕ | ● | ● | authorized queue/office statistics + actions |
| `ai.assistant.administration` | ✕ | ✕ | ● | system analytics, configuration help |

## 6. Navigation contract (per role, per platform)

Each entry below is a *different* navigation model, rendered by a different shell. Nothing is
appended to another role's list.

| Role / platform | Navigation |
| --- | --- |
| Visitor / Web | Campus · Map · Rooms · Events · Announcements · Sign in · Register |
| Student / Web | Dashboard · Timetable · Campus · Rooms · Queues · Office services · Events · Announcements · Notifications · AI Assistant · Profile |
| Student / Mobile | Home · Map · Queues · Office · Notifications — plus **Scan** and **Assistant** as prominent actions |
| Staff / Web | Dashboard · My queues · Office services · Timetable · Events & announcements · Notifications · Profile |
| Staff / Mobile | Queue · Office · Alerts |
| Admin / Web | Dashboard · Users · Roles & permissions · Campus (Buildings · Floors · Rooms) · Spatial (QR nodes · Navigation graph · Geofences) · Queues · Offices · Analytics · Audit · Settings |
| Admin / Mobile | Alerts · Monitoring |

## 7. Deliberate web/mobile divergences (do not "fix" these)

| Capability | Student Web | Student Mobile | Why they differ |
| --- | --- | --- | --- |
| Today's classes | a row in a week grid | the first card, with a countdown and a **Navigate** button | Web answers "what does my week look like"; mobile answers "where do I go now" |
| A room | search result → detail page with capacity, equipment, availability table, queue board | search result → one tap to route there, with the queue ticket inline | Web informs a decision; mobile executes it |
| Queue position | a status card + history table | position, people ahead, ETA, countdown, "you're next", check-in | Web is polling-tolerant; mobile is push-driven |
| QR | absent from navigation; manual code lookup for keyboard/screen-reader users | camera-first, primary action | A laptop on a desk cannot read a sticker on a wall |
| Office ticket | request, view status, read history | position + alerts + walk-to-office + check-in | Physical presence is required to be served |
| AI assistant | long answers, tables, links to detail pages | short answers that *do* something (start navigation, join queue) | Same engine, different affordances |

## 8. Adding a feature — checklist (blocking)

1. Add the matrix row (feature × 7 columns) with an explicit ●/○/◐/✕/⚙ in every column.
2. Add the permission(s) to §5 and to `App\Support\Access\Permissions`.
3. Add the journey to `docs/user-journeys.md` for each ● or ○ cell.
4. Put the endpoint in the correct role domain in `routes/api.php` with a `role:` guard, and a
   policy for resource scope.
5. Put the screen in the role's route tree (`app/(student)`, `app/(staff)`, `app/(admin)`, or the
   mobile role group) — never in a shared "just hide it" page.
6. Add it to that role's navigation model only.
7. Record the platform-specific design research in `docs/design-research.md` with a **Platform** column.
8. Add the feature test pair: `200` for the authorized role, `403` for each unauthorized role.
9. Run `npm run check` — PHP syntax, the API/role/platform contract, and both typechecks.   The contract checker resolves every path in `frontend/lib/api/endpoints.ts`, `mobile/src/lib/api.ts`
   and `backend/tests/**` against `routes/api.php`, and reads platform ceilings out of
   `Permissions::GRANTS`, so a step skipped above shows up as a failing check rather than as a live demo
   that quietly 404s.
