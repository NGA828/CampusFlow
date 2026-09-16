# Individual web pass — student timetable and office services

Date: 2026-09-15. Batch two, four canonical pages. Landing, global CSS, root layout and native mobile
are protected. Existing dirty work is preserved. Installed Next CSS Modules documentation read.

## Before implementation: workflow and contract audit

- Timetable: fixed 08:00–20:00 absolute blocks overlap and omit weekends in the five-day grid. Error
  can coexist with stale content. Preserve grid/day-list selection, week navigation and real room/map
  links; no calendar editing or invented bookings. Use API-published wall-clock times for teaching.
- Office directory: `StudentTicketController::officeHistory` returns raw ticket rows, not full ticket
  views. Existing nested reads can crash. Existing `/active` is also a raw ticket, and is global across
  offices; do not transplant it into whichever office detail happens to be open.
- Office detail: use its own `my_ticket`, move mutations to the canonical ticket page. Request form
  must honour appointment requirements, submit actual subject/notes and optional consented location,
  preserve idempotency on ambiguous retries, and follow a confirmed returned ticket ID. Estimated
  next number is not guaranteed; missing line detail is not permission to walk in. Service windows use
  0=Sunday, 1=Monday…6=Saturday. ISO opens_at cannot be sliced as if it were HH:mm.
- Ticket: API capability flags—not uppercase status guesses—govern controls. Lowercase status and
  event names are real wire values. Deadline is on the view; joined_at is on the ticket. Never turn a
  failed history read into “No events”. Avoid effects copying stale reads over successful mutations.
  Do not invent a completion progress percentage or certify live WebSocket updates without evidence.

## Research gate: searched, inspected, compared and selected before UI implementation

New search: Dribbble appointment booking dashboard/patient appointment/ticket; inspect appointment
and calendar shots and matching images, plus prior QMS/Stride/UVER research. Reference reuse is
explicit—this is not a claim of five newly discovered designs for each page.

Weights: visual 15%, usability 20%, hierarchy 15%, interaction 10%, responsiveness 10%, mobile 10%,
accessibility 5%, typography 5%, CampusFlow relevance 10%. Scores are subjective transfer estimates,
not measured usability/accessibility of the designers' products. Thumbnail-only limitations apply.

| ID / title / designer | Source and inspection | Strength / weakness / applicable idea | V/U/H/I/R/M/A/T/C | Weighted |
|---|---|---|---|---|
| P — Doctor Appointment, Dashboard version; Panda Design / Waiki Creative Labs | https://dribbble.com/shots/17585183-Doctor-Appointment-Dashboard-version — fetched page and visually inspected matching image userupload 37387086 | Strong service summary + calendar + action separation; reject provider KPIs, patient data and excessive pastel status colour. Use compact identity and a distinct request surface. | 8/8/9/7/7/6/6/8/8 | 7.65 |
| C — Dashboard Calendar, Restaurant Table Booking; Bor Kolar | https://dribbble.com/shots/7268044-Dashboard-Calendar-Restaurant-Table-Booking — fetched author description; matching titled calendar thumbnail on designer profile visually inspected, low-resolution, not full-resolution proof | Overview/next-up/detailed calendar hierarchy; tiny dense cells are unsuitable for phones. Transfer chronological day columns, not restaurant reservations. | 8/8/9/7/7/6/6/8/8 | 7.65 |
| Q — QMS Queueing Management App; FlutterMate | https://dribbble.com/shots/21221213-QMS-Queueing-Management-App — reopened page; matching thumbnail previously visually inspected in mobile/web pass | Facility selection → ticket → queue monitoring is directly relevant. Reject unsupported appointment scheduling and notifications promises. | 8/9/9/8/8/9/7/8/10 | 8.60 |
| S — Stride Task Management Dashboard; Adhitya Putra / Hatypo | https://dribbble.com/shots/25644823-Stride-Task-Management-Dashboard — reuse documented matching visual/page inspection from previous pass | Task grouping, prominent state and quieter history rail; desktop density needs reflow. | 9/9/9/8/8/7/7/9/8 | 8.40 |
| U — UVER Universities Aggregator; Phenomenon Product / Phenomenon Studio | https://dribbble.com/shots/19285593-UVER-Universities-Aggregator-Mobile-App — reuse documented page and studio-cover visual inspection | Search-first discovery and distinct selected states; reject admissions flows. | 9/9/9/8/9/9/7/9/9 | 8.80 |

Research imagery stays in ignored scratch. No source assets, invented office photographs, barcode or
QR patterns enter the app. Reuse the existing original fictional campus art only as decoration.

## Individual decisions

### Timetable — compare C / P / S / U → C + S

A compact weekly planning masthead with session/course counts computed from the returned week. A
next-session panel alongside a quiet read-only schedule explanation. A seven-day-capable board of
chronological session cards, not overlapping absolute geometry; deliberate horizontal scroll for an
explicit narrow grid. Mobile defaults to the day list. Week navigation remains the primary control.
Show empty days, full course descriptions via native disclosures, unknown rooms without dead links.

### Office directory — compare Q / P / S / U → U + Q

A service directory rather than another dashboard: concise campus-services masthead, search and open
filter, office rows with obvious open/closed state, real wait estimate and location. A separate personal
visit rail shows raw history safely and links to canonical ticket pages. Failed history leaves office
browsing usable; failure is not an empty history. Avoid a made-up “best office” recommendation.

### Office detail/request — compare Q / P / C / S / U → P + Q

Office identity and location first. A visit preparation column with service hours and admission
requirements. Distinct numbered request workflow (reason → optional context → submit), not an
optimistic issued ticket. Existing ticket belongs to this office only and links to its dedicated page.
Service windows and current anonymous line have their own disclosure/section. Appointment-first
offices show contact information when supplied, not a fake booking button.

### Office ticket — compare Q / P / S / U → Q + S

An original perforated ticket composition: large real ticket number, office and state; a separate
next-action panel and real history rail. Capability-gated mutation buttons, cancellation confirmation,
independent history failure/retry, explicit refresh. Terminal tickets become receipts instead of
continuing to promise a queue position. Full notes behind disclosure; no fake QR code or countdown.

## Planned validation

Each page at 320/768/1440; read errors/empty states, history wire shape, scoped office ticket,
request rejection/success, idempotency, denied browser location, server capability flags, terminal
receipts, cancelled mutation failure, history retry, unusual timetable hours/weekends/overlaps and
local week navigation. Production build, typechecks/lint/API/PHP gates, previous web regressions,
screenshot inspection and ten-dimension scores. Preserve landing hashes and cold/client CSS isolation.
Full all-role completion remains tracked separately in web-page-tracker.md.

Contract clarification found during final review: `createTicket` does not treat `is_open_now` as a
request capability. Therefore closed status remains an explicit warning, not a client-invented ban on
remote requests. The server decides issuance; the UI never guarantees service today. Appointment-only
and daily-capacity restrictions are implemented by the backend and shown as requirements.

## Implemented / visually reviewed

All four pages now have individual compositions; shared shell styling is not counted as completion.

- **Timetable:** concise date-range masthead, real course/session counts, upcoming/in-progress summary,
  seven chronological day columns and responsive day list. Early, late, Sunday and overlapping sessions
  all remain visible. Published 24-hour times avoid browser timezone conversion of campus teaching
  times. Local calendar arithmetic fixes the near-midnight Monday→Sunday UTC bug.
- **Directory:** searchable open-first office rows, status and actual wait figures, separate personal
  visit rail. History consumes the actual flat wire rows (`joined_at`, `office_name`, `office_code`)
  rather than pretending they are full ticket views. Closed-office requests remain possible but never
  promise same-day service. Long office codes use a decorative office icon rather than broken letters.
- **Office details/request:** scoped `my_ticket`, visit requirements, compact request form, service
  windows with correct Sunday handling, anonymous line snapshot and real contact information. No
  global active-ticket transplant. Subject/notes length limits match the backend; ambiguous retries
  keep their idempotency key; raw replay responses open the canonical ticket via the confirmed ID.
  Browser position is requested only on a deliberate submit when configured, never fabricated.
- **Ticket:** original perforated ticket with actual number, state, wait/window and deadline; independent
  history rail; capability-controlled actions, deliberate cancellation confirmation, terminal receipts.
  Successful API responses update the screen directly and cannot be overwritten by a delayed copied
  initial read. Missing history remains an error with retry. Refresh is explicit; this is not sold as a
  connected live queue when there is no verified real-time subscription.

Screenshot review covered all four desktop and narrow compositions. Fixes from that review: shortened
calendar date/time typography, tightened the mobile request introduction, replaced a broken long code
badge, and contained absolutely positioned accessibility labels in the horizontally scrolling calendar.
The initial 768px overflow check caught that last defect; the final tablet and narrow-grid tests pass.

### Ten-dimension quality gate

Subjective self-review, not external user testing. Order: visual quality, usability, information
hierarchy, consistency, responsiveness, accessibility, interaction, performance, campus relevance,
originality. Native-device, screen-reader and cross-browser certification remain outstanding.

| Page | Scores | Mean |
|---|---|---|
| Timetable | 8 / 8 / 9 / 8 / 8 / 8 / 8 / 9 / 9 / 8 | 8.3 |
| Office directory | 8 / 9 / 9 / 8 / 8 / 8 / 8 / 9 / 9 / 8 | 8.4 |
| Office details/request | 8 / 9 / 9 / 8 / 8 / 8 / 8 / 9 / 9 / 8 | 8.4 |
| Office ticket | 9 / 9 / 9 / 8 / 8 / 8 / 9 / 9 / 9 / 8 | 8.6 |

### Final validation

- **131/131 web browser checks pass together in 3.1 minutes**: 32 new service checks plus 99 existing
  web checks. Controlled API fixtures are clearly separated from runtime code.
- New coverage includes 320/768/1440 layouts; API rejection; independent empty/error states; flat
  history; office-scoped tickets; request confirmation/replay/idempotency; denied location; appointment,
  capacity and advisory closed-office states; capability flags; in-flight action locking; cancellation
  rejection/confirmation; terminal receipts; timeline retry; unusual timetable hours, weekends,
  overlaps, unknown-room links, week switching, keyboard disclosure, Africa/Douala midnight dates.
- Production build, frontend lint, both client typechecks, 125 PHP syntax checks and the API contract
  audit pass (199 routes / 185 web calls / 82 mobile calls / 67 contract test calls / 62 permission pairs /
  zero problems). No backend permission/controller or native app files changed in this batch.
- Landing sources still match their protected hashes. The cold/client-navigation isolation test now
  loads **both discovery and timetable/service CSS**, logs out and navigates back to landing. Stable
  full-page snapshots have **zero differing channels**. Evidence: `student-services-landing-preservation.json`.
- Known limitations: no deployed-backend E2E, native location/camera, WebSocket or screen-reader
  certification. The existing backend detailed-navigation response mismatch remains outside this
  batch; route links are real but fixture route success is not backend route certification. Mobile's
  earlier 66 browser checks were not rerun because no native UI code changed here.

Gallery: `student-services-review.html`, four desktop/narrow pairs of the implemented app with fixture
data. The tracker records **8 of 31** canonical signed-in pages completed in the expanded pass. The
remaining student/shared and staff/admin pages have not silently been marked complete.
