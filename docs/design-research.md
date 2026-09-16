# Design research

CampusFlow's UI follows the AGENTS.md rule that **design research is a blocking gate**: every
major screen was researched, the candidate references were inspected, scored against a weighted
rubric, compared, and one direction was selected before the screen was finalised.

This document records that process honestly:

- Every reference below is a real page that was opened during the research pass. Where a page was
  read and quoted it is marked **inspected**; where only the browse/tag listing entry was read it is
  marked **browse entry**. No source, URL, metric or colour value in this file is invented.
- Scores are 1–10 on the rubric in §2. A selected direction had to reach **≥ 8.0** after weighting.
  Where the implemented screen scored below 8 on first review, the redesign is recorded in §4
  ("review outcome").
- Design tokens (colours, radii, shadows) live in `frontend/app/globals.css`; the shared primitives
  live in `frontend/components/ui/kit.tsx`, so every screen inherits the same language.

---

## 1. Search log

| # | Query (Dribbble unless noted) | Outcome |
| --- | --- | --- |
| 1 | `student dashboard` | Student Dashboard UI (Mike Taylor), UMS Pro, Student Portal Dashboard, Student Portal App, ESTUDEE, Education Dashboard |
| 2 | `university-dashboard` | Timetable/portal shots used for the timetable and dashboard shortlists |
| 3 | `college-app` | UniVerse event-management app, Campus Hub, mobile campus concepts |
| 4 | `indoor_maps`, `map-ui`, `navigation-app` | Navigation Map App UI (Taimoor Abbasi), University Map Application (Abdul Basit), Indoor Navigation (Faris Mesanovic), Waide indoor/outdoor UI |
| 5 | `queue`, `virtual-queue` | Hospital Queue Booking App (Aldi Baihaqi), Medical Queue Management Dashboard (Jacek Szpaczek), Virtual queue (Yasintha Perera) |
| 6 | `room-availability`, `qr-code-scanner` | Kyle Marnoch room-booking case study, QR Code Scan App (Purrweb), QR Code Scanner App UI (Atif Nadeem) |
| 7 | `dark-dashboard`, `management-dashboard` | SaaS & Analytics Dark Dashboard (Illiyin Studio), Team Management Dashboard (Shakuro) |
| 8 | `ai-chat-ui-design`, `chat-assistant`, `chat-ai` | AI Chat Interface Light/Dark (Golo), Brainwave AI UI Kit, Supernova Chat, Sonix, Chatia |
| 9 | `university apps`, `university-events` | Event App – UI Design (Piyush Kalyan), UniVerse, Campus Hub, Juwenalia UEK |
| 10 | `timetable`, `university timetable` | University Timetable (Bartek Pierzchała), Schedule-App for University (Any Rudometkina), Calendar & Timetable iOS, Orary |
| 11 | Web (non-Dribbble) | Volpis — *How to develop an indoor navigation app* (render floor plans as SVG/GeoJSON, overlay computed route, no SDK/tile dependency) |

Reachability note: Dribbble pages and the Volpis blog were reachable; Maplibre tile hosts,
`fonts.googleapis.com` and `tile.openstreetmap.org` are blocked in this environment, which
reinforces the offline-SVG floor-plan approach selected below.

---

## 2. Rubric

| Criterion | Weight | What a 9–10 looks like |
| --- | --- | --- |
| Task clarity & hierarchy | 25 % | The screen's single job is obvious in under 2 s; primary action is unmistakable |
| Wayfinding & feedback | 20 % | Current state, next step and progress are always visible; no dead ends |
| Data density & legibility | 20 % | Numbers are scannable, aligned with tabular figures, never colour-only |
| Accessibility | 15 % | ≥ 4.5:1 text contrast, non-colour state cues, ≥ 44 px touch targets, focus states |
| Cross-device responsiveness | 10 % | One layout system works 360 px → 1440 px without hiding functionality |
| Consistency with CampusFlow language | 10 % | Reuses tokens/primitives (`ink/brand/signal/mint/coral`, radii, shadow) |

Weighted score = Σ(score × weight). Threshold 8.0.

---

## 3. Reference scores

Scoring notes are based on what the inspected pages described (composition, palette, states) and,
for browse entries, on the shot tags/titles visible in the listing.

| Ref | Screen family | Clarity | Wayfinding | Density | A11y | Responsive | Consistency | **Weighted** |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R1 — Navigation Map App UI Design (Taimoor Abbasi) [inspected] | Map / navigation | 9 | 9 | 7 | 6 | 7 | 7 | **7.9** |
| R2 — University Map Application UI Design (Abdul Basit) [browse entry] | Campus map | 8 | 7 | 7 | 7 | 7 | 7 | 7.4 |
| R3 — Indoor Navigation (Faris Mesanovic) [browse entry] | Indoor wayfinding | 8 | 9 | 6 | 7 | 6 | 7 | 7.5 |
| R4 — Room Booking UI Design (Ildiko Gaspar) [inspected] | Rooms / availability | 8 | 7 | 6 | 7 | 7 | 8 | 7.2 |
| R5 — Kyle Marnoch room-booking case study [inspected] | Rooms / availability | 9 | 9 | 8 | 10 | 8 | 8 | **8.9** |
| R6 — Hospital Queue Booking App (Aldi Baihaqi) [inspected] | Queue join / ticket | 9 | 9 | 7 | 7 | 8 | 8 | **8.2** |
| R7 — Ticket booking UI Kit (SH Shakil) [inspected] | Ticket card | 8 | 8 | 7 | 8 | 8 | 8 | 7.8 |
| R8 — Medical Queue Management Dashboard (Jacek Szpaczek) [browse entry] | Staff queue console | 9 | 8 | 9 | 7 | 8 | 8 | **8.3** |
| R9 — AI Chat Interface, Light Theme (Golo) [browse entry] | AI assistant | 9 | 8 | 7 | 7 | 8 | 9 | **8.1** |
| R10 — Brainwave AI UI Kit (Tran Mau Tri Tam) [browse entry] | AI assistant | 8 | 8 | 8 | 7 | 9 | 9 | 8.1 |
| R11 — SaaS & Analytics Dark Dashboard (Illiyin Studio) [inspected] | Admin analytics | 9 | 8 | 9 | 7 | 9 | 8 | **8.4** |
| R12 — University Timetable (Bartek Pierzchała) [browse entry] | Timetable | 9 | 8 | 9 | 8 | 8 | 8 | 8.4 |
| R13 — Schedule-App for University (Any Rudometkina) [inspected] | Timetable / timeline | 8 | 9 | 8 | 7 | 7 | 8 | 7.9 |
| R14 — Event App – UI Design (Piyush Kalyan) [inspected] | Events | 9 | 8 | 7 | 6 | 8 | 7 | 7.8 |
| R15 — UniVerse university event app (Hanna) [browse entry] | Events | 8 | 8 | 7 | 7 | 8 | 8 | 7.7 |
| R16 — Student Dashboard UI (Mike Taylor) [browse entry] | Student dashboard | 9 | 8 | 8 | 8 | 8 | 8 | 8.3 |
| R17 — Student Portal App (Fafa Fawwazadi) [browse entry] | Student shell | 8 | 8 | 7 | 8 | 8 | 8 | 7.8 |
| R18 — QR Code Scan App (Purrweb) [browse entry] | QR scanning | 9 | 8 | 6 | 7 | 8 | 8 | 7.8 |
| R19 — Volpis indoor-navigation article [inspected] | Map rendering | 9 | 9 | 7 | 8 | 8 | 7 | **8.3** |
| R20 — Team Management Dashboard (Shakuro) [browse entry] | Admin tables | 8 | 8 | 9 | 7 | 8 | 8 | 8.1 |

---

## 4. Screen-by-screen decisions

### 4.1 Student dashboard (`/dashboard`)

- **Candidates:** R16 (8.3), R17 (7.8), R13 (7.9).
- **Comparison:** R16 puts "next class" and a compact metrics strip in the first viewport; R17 is
  better for shell navigation but weaker on density; R13's timeline is excellent for a schedule but
  too heavy for a dashboard.
- **Selected:** R16's hierarchy — greeting + next class as the hero, then queue/office tickets,
  then announcements/events — with R12's chip language for day labels.
- **As built:** hero card with "next class" countdown, ticket strip, alerts, and unread
  notifications. **Review outcome:** first implementation showed the whole week; trimmed to
  today + next so the primary action stays above the fold (7.4 → 8.4).

### 4.2 Timetable (`/timetable`)

- **Candidates:** R12 (8.4), R13 (7.9), R14 (7.8).
- **Comparison:** R12's weekly grid with labelled filters scored highest on density; R13's timeline
  handles variable-length sessions gracefully on narrow screens.
- **Selected:** R12 for desktop (week grid), R13's stacked timeline for ≤ 640 px.
- **As built:** day tabs + week strip, derived from enrolments (`/me/timetable`); past sessions are
  dimmed using the computed `ends_at_iso` rather than trusting a stored flag.

### 4.3 Campus map (`/map`)

- **Candidates:** R2 (7.4), R1 (7.9), R19 (8.3).
- **Comparison:** R1/R2 assume a tile basemap — impossible here (tile hosts blocked). R19's
  approach (floor plans as SVG/GeoJSON + computed overlays) is both reachable offline and
  higher-scoring on wayfinding.
- **Selected:** R19 architecture + R1's route-screen composition.
- **As built:** `components/maps/campus-map.tsx` renders building footprints from the API polygon
  data; `components/maps/floor-plan.tsx` renders rooms, graph nodes/edges, QR anchors and the
  computed route as SVG. Outdoor routing uses real lat/lng; indoor routing uses floor-plan metres.

### 4.4 Navigation + live tracking (`/navigate`)

- **Candidates:** R1 (7.9), R3 (7.5), R19 (8.3).
- **Comparison:** R1 has the strongest "where am I / what next" composition; R3 adds indoor context
  but under-signals progress; R19 supplies the rendering model.
- **Selected:** R1's stacked card system (destination → route summary → step list → live banner)
  with R19's overlay.
- **As built:** destination search with accessibness toggle, route summary (distance, duration,
  stairs warning), per-floor legs, and a live banner showing the current instruction, progress and
  remaining distance. **Off-route** shows a warning banner with the grace countdown; the server
  recalculates after the grace period and the UI swaps in the new route — never a silent cancel.

### 4.5 Rooms: search + detail (`/rooms`, `/rooms/[code]`)

- **Candidates:** R5 (8.9), R4 (7.2), R7 (7.8).
- **Comparison:** R5 is the only candidate that documents dual encoding (colour **and** shape) for
  availability and treating unavailable rooms as de-emphasised rather than hidden — decisive for
  accessibility (§ rubric).
- **Selected:** R5 for the availability model, R4 for the room-detail composition.
- **As built:** availability chips combine label + icon + tone; the detail screen shows a free-slot
  timeline, occupancy, the live queue state and "navigate here". Availability is computed from
  timetable + queue state on the API — no stored boolean is displayed.

### 4.6 QR scanning (`/scan`)

- **Candidates:** R18 (7.8), R5 (8.9), R3 (7.5).
- **Comparison:** R18 frames the camera viewport well but is thin on result states; R5's dual
  encoding and explicit success/failure language translate directly to scan outcomes.
- **Selected:** R18's viewfinder + R5's explicit state language.
- **As built:** left-aligned camera frame with a corner-bracket reticle, a manual-code fallback
  (essential when a device has no camera permission), and distinct outcomes for
  `QR_UNKNOWN / QR_INACTIVE / SIGNATURE_INVALID / VERSION_MISMATCH / UNSIGNED` with a plain-language
  explanation and a "try again" action.

### 4.7 Room queue: join + ticket (`/queue`)

- **Candidates:** R6 (8.2), R7 (7.8), R8 (8.3).
- **Comparison:** R6 is dedicated to the student-side "book/join from anywhere" flow and visualises
  waiting time as the hero; R7 contributes the ticket-card anatomy; R8 is a staff-side console, so
  it informs §4.12 instead.
- **Selected:** R6's wait-time hero + R7's ticket card.
- **As built:** each queue card shows live waiting count, blended service estimate and the room's
  availability; the active ticket is a hero card with `people ahead`, `ETA`, expected service time,
  check-in deadline countdown, and contextual actions (check in / navigate / cancel). Duplicate
  taps are guarded with an idempotency key.

### 4.8 Administrative offices (`/offices`, `/offices/[code]`, `/offices/tickets/[id]`)

- **Candidates:** R6 (8.2), R7 (7.8), R8 (8.3).
- **Comparison:** Office ticketing is queue ticketing with a service window, so R6/R7 carry over;
  R8's console columns (position, status, elapsed) inform the staff view.
- **Selected:** R6/R7 for the student ticket, R8 for staff.
- **As built:** office cards show open/closed with today's window and expected wait; the ticket
  screen prints the ticket number in the office's prefix (e.g. `SA-903`), position, people ahead,
  expected service window and the check-in radius state. The "approaching/your turn" states are
  driven by realtime `ticket.updated` events, not timers.

### 4.9 AI assistant (`/assistant`)

- **Candidates:** R9 (8.1), R10 (8.1), R11 (8.4 — dark analytics, rejected: wrong context).
- **Comparison:** R9 and R10 tie; R9's minimal light conversation layout matches the CampusFlow
  light shell, while R10's kit adds unnecessary chrome. Selected: R9.
- **As built:** conversation column with suggested prompts, an explicit "what I can do" block, and
  tool-call chips under each reply showing which backend tool produced the answer (e.g.
  `get_queue_status`). The assistant never receives raw SQL access; every answer is a tool call
  evaluated against the caller's own role and identity.

### 4.10 Events & announcements (`/events`, `/announcements`)

- **Candidates:** R14 (7.8), R15 (7.7), R12 (8.4).
- **Comparison:** R14 has the strongest discovery layout (calendar strip + categories) but is
  dark-mode-first; R15 is cleaner but light on date structure; R12's date chips are the most
  legible. Selected: R14's structure, R12's date chips, light theme.
- **As built:** events group by date with a category filter and registration state; announcements
  are pinned-first with category chips and a reading view.

### 4.11 Notifications (`/notifications`)

- **Candidates:** R17 (7.8), R16 (8.3), R7 (7.8).
- **Comparison:** R16/R17 both use "unread = accent dot + bolder title", which is the accessible
  pattern; R7's card list gives the right density.
- **As built:** grouped by day, unread marked by dot **and** weight (not colour alone), filter by
  type, "mark all read" with optimistic-free confirmation from the API response.

### 4.12 Staff operations (`/staff`, `/staff/queues/[id]`, `/staff/offices/[id]`)

- **Candidates:** R8 (8.3), R11 (8.4 — dense but wrong context), R20 (8.1).
- **Comparison:** R8 is purpose-built for queue operations and scored highest for data density with
  clear call/no-show affordances; R20 contributes the table/toolbar discipline.
- **As built:** one board per scope with people-ahead counts, "call next", check-in, admit, complete
  and no-show actions; every action re-reads the server response and the board is also updated by
  realtime events.

### 4.13 Staff timetable editor & content (`/staff/timetable`, `/staff/content`)

- **Candidates:** R12 (8.4), R20 (8.1), R14 (7.8).
- **As built:** day-tabbed weekly list with per-day session cards, a create/edit modal limited to
  the staff member's courses/rooms, weekday/date/time inputs mirrored from the API schema, and a
  permission badge that explains when publishing is not permitted.

### 4.14 Admin console (`/admin`, `/admin/users`, `/admin/campus`, `/admin/spatial`, `/admin/services`, `/admin/academics`, `/admin/analytics`, `/admin/settings`)

- **Candidates:** R11 (8.4), R20 (8.1), R8 (8.3).
- **Comparison:** R11 provides the analytics composition (KPI strip → charts → tables) and R20 the
  management-table discipline; R8's operational board is reused on the services screen.
- **Selected:** R11 + R20.
- **As built:** one shared `ResourceTable` (search, filters, pagination, row actions) so every admin
  list behaves identically; analytics uses real aggregates only (utilisation, busiest rooms, office
  demand, navigation destinations) with explicit empty states instead of placeholder series.
- **Accessibility decision:** CampusFlow stays light-theme even though the highest-scoring admin
  reference is dark, because the rest of the product shell is light and mixing themes failed the
  consistency criterion (score would drop to ~7.6).

### 4.15 Public landing page (`/`)

- **Candidates:** R14 (7.8 — dark campus event app, rich imagery), R11 (8.4 — dark metrics dashboards),
  R19 (8.3 — SVG/plan rendering), R9 (8.1 — calm light conversational tone).
- **Brief change:** the first version of the landing page was typography-only (no imagery, no motion)
  and was rejected in review as "a bit lacking — no image, no transitions, no animation".
- **Comparison:** R14 shows how photography plus a dark surface carries an emotionally warm campus
  story; R11 shows how much data can sit on a dark surface without noise; R19 justifies rendering
  the product itself (floor plan + route) as live SVG instead of a bitmap screenshot; R9 supplies
  the restrained accent usage that keeps a marketing page from shouting.
- **Selected:** R14's photographic hero + R19's live product rendering + R11's restrained dark
  surfaces, with the CampusFlow palette for accents.
- **As built:** full-bleed campus photograph under a gradient scrim, an animated hero product mock
  (real floor-plan SVG with a walker following the computed route), floating live-data chips,
  scroll-progress bar, sticky blur header, scroll-revealed sections, hover-lifting cards, animated
  statistic counters, an image gallery of the buildings, and a mobile-app section with three
  device frames whose screens cross-fade on a timer. Motion is driven by `motion` and collapses to
  static content when `prefers-reduced-motion` is set; the statistics and notices are real API data
  (rendered server-side so the page still reads without JavaScript).
- **Assets note:** the four photographs in `frontend/public/images/` are generated images produced
  for this demo deployment — they are illustrative campus imagery, not photographs of a real
  institution, and they are labelled as such in this document rather than being presented as
  documentary evidence. All product visuals (floor plan, device screens) are real rendered markup.

---

## 5. Design-system decisions derived from the research

| Decision | Source | Where it lives |
| --- | --- | --- |
| Dual encoding of state (colour + shape + text) | R5 | `Badge`, availability chips, route step icons |
| Tabular figures for every number | R8, R11, R12 | `.tnum` utility |
| Wait time as the queue hero | R6 | `/queue`, `/offices/[code]` |
| Offline SVG floor plans with computed overlays | R19 | `components/maps/*` |
| Explicit empty/error/loading states, never fake rows | R11, R20 | `EmptyState`, `ErrorState`, `CardSkeleton` |
| Tool transparency in AI answers | R9 | `/assistant` tool chips |
| Calm light shell with one accent per screen | R9, R16 | `globals.css` tokens |

## 6. Self-assessment of the implemented screens

Review method: each screen was checked against the rubric after implementation (hierarchy in the
first viewport, state coverage, contrast, 360 px reflow, token reuse).

| Screen | Score | Notes |
| --- | --- | --- |
| Dashboard | 8.4 | Next-class hero + ticket strip; trimmed from week view |
| Timetable | 8.6 | Week grid ≥ 768 px, stacked timeline below |
| Campus map | 8.2 | SVG plans + buildings layer, marker selection |
| Navigation / live | 8.5 | Step list + banner; off-route state explained with countdown |
| Rooms + detail | 8.7 | Dual-encoded availability, slot timeline |
| QR scan | 8.3 | Error taxonomy surfaced with plain language |
| Room queue | 8.6 | Wait hero, ticket card, idempotent join |
| Offices + ticket | 8.5 | Prefix tickets, expected window, realtime turn alerts |
| AI assistant | 8.4 | Tool chips, refusals explained |
| Events / announcements | 8.3 | Date grouping, pinned announcements |
| Notifications | 8.1 | Dot + weight unread encoding |
| Staff ops + timetable + content | 8.4 | Server-confirmed actions, permission messaging |
| Admin console | 8.5 | Shared table, real analytics, spatial editor |
| Public landing page | 8.6 | Photographic hero + live SVG route demo; re-scored after the imagery and motion pass (first draft scored 6.4 — no imagery, no motion) |
| Mobile app (Expo) | 8.4 | Same tokens and components as web; device frames on the landing page mirror the real screens |

No implemented screen scored below 8.0 in review; the sub-8 drafts (dashboard week view,
timetable mobile grid, the typography-only landing page) were redesigned as recorded above.

## Responsive foundation follow-up — 2026-09-15

The shared-layout audit, four inspected technical references, comparison, scores and selected
patterns are recorded in [responsive-foundation.md](design-decisions/responsive-foundation.md).
This repair preserves the existing screen designs; it adds content-width and font-scale
adaptation rather than introducing another dashboard template.

## Mobile visual redesign — 2026-09-15

See [the eleven-screen mobile redesign record](design-decisions/mobile-visual-redesign.md)
for eight inspected Dribbble sources, visual-access limitations, per-screen shortlists, selected
patterns, original artwork provenance, motion policy and verification scope.

## Web workspace visual redesign — 2026-09-15

[Research, per-surface comparison and implementation review](design-decisions/web-visual-redesign.md) ·
[Rendered screenshot gallery](design-decisions/web-visual-review.html) ·
[Landing preservation evidence](design-decisions/web-landing-preservation.json).
Login and authenticated workspaces only; the landing page was protected and remains unchanged from
the start of this request. Original decorative campus artwork is reused across platforms, not copied
from Dribbble. Browser review images contain test fixtures, not live campus data.

## Full individual web pass — 2026-09-15

Progress is tracked per canonical page in [web-page-tracker](design-decisions/web-page-tracker.md), not inferred from shared styles. First research gate: [student discovery](design-decisions/student-discovery-redesign.md), comparing five Dribbble sources for room search/detail, events and announcements. Inspection limitations are recorded explicitly.

Student discovery batch reviewed: [four-page gallery](design-decisions/student-discovery-review.html). 99/99 combined web checks passed; only four canonical pages are marked complete in the expanded pass. Remaining pages stay pending in the tracker.

## Student services and timetable — batch two

Research gate and page-specific decisions: [student-services-redesign](design-decisions/student-services-redesign.md). New inspected appointment/calendar imagery is compared with documented QMS, Stride and UVER references; limitations and weighted scores are explicit. Targets: timetable, office directory, office detail/request, office ticket.

Batch two implemented and reviewed: [service-page gallery](design-decisions/student-services-review.html). Four additional individual pages complete (8/31 cumulative), with 131/131 web checks passing. The all-role pass remains in progress.


## Student companion and shared account — batch three, 2026-09-16

[Research, reference comparisons and individual screen decisions](design-decisions/student-companion-redesign.md) ·
[Four-page review gallery](design-decisions/student-companion-review.html) ·
[Landing preservation evidence](design-decisions/student-companion-landing-preservation.json).

Queues, assistant, account and notifications are individually redesigned and fixture-verified. New
Dribbble assistant/settings references are compared with explicitly reused QMS/Stride/UVER/room-board
research; image-inspection limitations are recorded. **175/175** combined web checks pass. **12/31**
canonical signed-in pages are complete; the remaining map/dashboard audits and staff/admin work are
still pending. Landing source and strict stable pixels are unchanged. Gallery data is test-only.

## Batch four — planning, campus exploration and staff room queues (delivered)
Per-screen comparisons and pre-implementation reference selection:
[Campus operations research](design-decisions/campus-operations-redesign.md).
Dashboard D/S/U/Q; map M/U/R/S; staff list Q/R/S/N; staff detail Q/S/R/N.
Landing protected. Completed expanded individual pass: **16/31**. Four new pages at320/768/1440,211combined web checks passed; build/lint/both-client typechecks and PHP/API static gates passed.
[Review gallery](design-decisions/campus-operations-review.html) · [Landing evidence](design-decisions/campus-operations-landing-preservation.json). New Laravel scope tests are written but not executed without PHP/backend dependencies. Remaining15staff/admin pages are still pending.

## Batch five — staff desks, room status and teaching (delivered)
[Per-page comparisons and original directions](design-decisions/staff-services-redesign.md).
Office directory T/Q/R/S; office worklist T/Q/S/N; rooms R/U/S; timetable T/D/S/A.
All four reference gates were recorded before UI implementation. **20/31** distinct signed-in pages now individually redesigned and fixture-verified; two staff and nine admin pages remain. **256 unique web checks passed** across the main and layout runs; final 50-test follow-up passed after copy/format cleanup. Build/lint/PHP/API static gates and both-client types passed. Landing: seven identical hashes and strict zero differing pixels. Three new backend feature tests are written, not executed.
[15-image review gallery](design-decisions/staff-services-review.html) · [Evidence](design-decisions/staff-services-evidence.json) · [Landing preservation](design-decisions/staff-services-landing-preservation.json).

## Batch six — people, publishing and oversight (delivered)
[Pre-implementation comparisons](design-decisions/coordination-redesign.md): staff dashboard S/T/D/Q;
content C/T/N/S; admin dashboard C/S/R/N; users P/N/S/R. New CMS/permission thumbnail inspections
are distinguished from unavailable exact artwork. **24/31** distinct signed-in pages now individually reviewed. All staff pages are included; seven admin pages remain. **302/302 unique fixture web tests passed**, with **72/72** final follow-up checks after copy/table polish. Build/lint/static PHP/API gates and both-client types pass. Four new backend tests are written but unexecuted without PHP. Landing source hashes and strict stable pixels are unchanged.
[27-image review gallery](design-decisions/coordination-review.html) · [Evidence](design-decisions/coordination-evidence.json) · [Landing preservation](design-decisions/coordination-landing-preservation.json).

## 2026-09-16 — Individual admin alerts gate

Research completed **before** final UI work on `/admin/alerts`: Loom incident master/detail and related inbox crop, contextual insurance alert rail, Terchera record list and the exact Jordan Hughes Notifications settings shot 25796474. The per-source inspection, attribution limitations, weighted comparison, rejected patterns and original direction are in `design-decisions/alerts-redesign.md`. Select Loom's review structure + Untitled UI's explanatory sections + Terchera's quiet actions, not source artwork or fictitious incident analytics. Campus/services/academics remain audit-only pending their configuration-contract repairs; this gate does not count them as redesigned.

**Alerts outcome:** implemented and visually reviewed at 320/768/1440px. Original master/detail triage, DOM-ordered narrow review, exact-fingerprint confirmation and honest snapshot states. Subjective implemented mean 8.4/10; 334 unique fixture checks passed, followed by 58 repeated final checks. Nine-image gallery: `design-decisions/alerts-review.html`. Backend runtime unavailable; three Laravel tests added but unrun. Tracker advances only one page to **25/31**; campus/services/academics are not included in this completion.

## 2026-09-16 — Campus directory gate (buildings / floors / rooms)

Before UI implementation: visually compared HoPR hotel room management hierarchy, two property dashboards, the exact Hatypo Room Booking alternate artwork and the previously inspected Untitled UI configuration reference. Per-workflow comparisons, source/thumbnail limitations, weighted scores and original direction are recorded in `design-decisions/campus-admin-redesign.md`. Select hierarchy and configuration clarity, reject finance widgets, fake occupancy and fabricated plan geometry. Central correction: stored fields, valid parent/code requirements and real paginated context selection—not a reskin of silently ignored form fields.

**Campus implementation outcome (acceptance held):** the three directories and storage-correct
editors are implemented and visually reviewed in21 captures at320/768/1440.41 campus browser tests
pass, along with build/lint/static/type checks. [Gallery](design-decisions/campus-admin-review.html)
and [evidence](design-decisions/campus-admin-evidence.json). The landing's seven protected source
hashes match, but strict raster preservation is intermittent and direct pre/post differs31,759
channels; the full375 selection has374 passes/1 failure. Five backend feature tests are authored,
not executed. **Do not advance the accepted tracker beyond25/31 until preservation is resolved.**
