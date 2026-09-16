# Staff desks, rooms and teaching — individual web pass, batch five

2026-09-16. Landing/root layout/global CSS protected against the previous batch's seven hashes.
Next CSS Modules guide and PROMPT research requirements read before implementation. This batch's
four target pages: staff offices, office detail, room management, teaching timetable.

## Pre-implementation research gate

New Dribbble searches: appointment/reception schedule dashboards; classroom/teacher timetables.
Inspected Terchera schedule-list thumbnail: horizontal time labels, central person/appointment context,
quiet filters, explicit actions. Exact matching shot page resolved and opened. Inspected Aule Course
Dashboard thumbnail: lesson tiles, lesson/teacher content separated from a quiet timetable rail.
Exact Aule shot not resolved: creator profile is the source; no invented shot ID. Attendance-management
search hits were not selected (CampusFlow has no attendance feature). Reopened R and S pages; their
previously documented visual inspections, and Q/U/D/N inspections, are explicitly reused.

Subjective transfer scores V/U/H/I/responsive/mobile/accessibility/typography/relevance;
weights15/20/15/10/10/10/5/5/10 percent. These are not measured product usability or WCAG findings.

|ID|Reference/source and designer|Studied strengths, weaknesses and adaptation|Scores; weighted|
|---|---|---|---|
|T|Schedule List — Terchera Online Appointment; Fariz Al /10am Studio. https://dribbble.com/shots/23673729-Terchera-Online-Appointment-Schedule-List|Person/time/action separation, quieter schedule filters. Dense tiny text in thumbnail; don't reproduce meeting integrations, booking or fake realtime presence.|8/9/9/8/8/7/7/8/9;8.30|
|A|Aule. — Course Dashboard; Ishak Erdogan. https://dribbble.com/erdoganishak ; exact shot Not available.|Lesson/teacher hierarchy with timetable rail. Mobile/accessibility unknown at thumbnail resolution; reject grading, attendance and course-completion metrics.|8/8/8/7/7/6/6/8/9;7.60|
|R|Room Booking Dashboard Admin; Adhitya Putra /Hatypo. https://dribbble.com/shots/20602523-Room-Booking-Dashboard-Admin|Room identity and grouped actions. Reject revenue KPIs and tiny controls; retain purposeful property/room grouping.|9/8/8/8/7/7/6/9/8;7.95|
|S|Stride; Adhitya Putra /Hatypo. https://dribbble.com/shots/25644823-Stride-Task-Management-Dashboard|Work/status hierarchy and quiet context. Don't turn backend transitions into draggable cards or invent productivity graphs.|9/9/9/8/8/7/7/9/8;8.40|
|Q|QMS; FlutterMate. https://dribbble.com/shots/21221213-QMS-Queueing-Management-App|Ticket identity and facility separation. Student-facing inspiration, not operator research. No guaranteed waiting times.|8/9/9/8/8/9/7/8/10;8.60|
|U|UVER; Phenomenon Studio. https://dribbble.com/shots/19285593-UVER-Universities-Aggregator-Mobile-App|Search and selection on small screens; avoid unsupported admissions workflows.|9/9/9/8/9/9/7/9/9;8.80|
|D|Studly; Marina Shevchenko /Netguru. https://dribbble.com/shots/17726302-Studly-Mobile-App-for-Students|Schedule-first hierarchy and course bands; reject progress/payment/homework features.|8/9/9/8/8/9/7/8/10;8.60|
|N|Notification settings; Jordan Hughes. https://dribbble.com/shots/17219721-Notification-settings-page-Untitled-UI|Clear section labels and explanatory settings context. Not a source for invented preferences or mutable staff policy.|8/9/9/8/8/8/7/8/8;8.30|

### Office directory: compare T/Q/R/S → R + T
A service-desk directory, not a second room-queue board: office identity tiles, waiting/in-service counts,
search, clear desk-console links, and guidance that separates active configuration from current hours.
No student names or invented current-service row in this list. Original office line illustration via
existing CampusFlow iconography, no unlicensed source artwork.

### Office detail: compare T/Q/S/N → T + Q
A reception worklist: waiting list alongside arrival/in-service cases with subject and student identity.
One Call next button; focused service review panel. Office check-in starts service in this actual API,
so label it honestly, not as an intermediate queue-style check-in. Weekly service windows show weekdays,
not falsely "today". Policies read-only. Mobile selected-case workspace has explicit focus/return links.

### Rooms: compare R/U/S → R + S
An estate-status workspace: paginated room rows, text search, explicit view-only vs changeable status,
and a deliberate selected-room update form. No select-on-change mutation and no promise that room
status replaces admission rules. No invented stock photo of a real room; schematic room icon only.

### Timetable: compare T/D/S/A → D + T
Teaching week arranged by weekday with chronological session strips, all seven days including Sunday0,
course/time/room context, and an inline session editor. Scope/permissions come from backend data.
Only supported fields may be edited; course/term immutable for existing rows. Empty catalogue/error
states keep drafts and do not pretend to publish. No local drag/drop, invented attendance or conflicts.

## Contract findings to address

- Offices: list uses office_staff but detail uses StaffScope. Align list with the existing operation
  policy, not a new client-side grant. Return real counts and location. Active status isn't open-now.
  Office raw line has user_name, lowercase states, joined_at, no check-in deadline or checked-in count.
  check-in endpoint returns in_service. Weekly windows include day_of_week; don't assume today.
- Rooms: current staff read delegates to campus read (all rooms), while update is assigned-only. Keep
  those existing read/write permissions; return per-row can_update_status from the server. Missing
  Illuminate Validation Rule import currently breaks updates. Normalize real paginator/type fields.
- Timetable: backend emits course_name/type and day0–6; existing form sends session_type and HH:mm,
  offers unsupported exam/notes/group fields and drops Sunday. Return usable catalogue/term choices;
  send type and HH:mm:ss, validate responses. Guard each domain with its own existing permission rather
  than requiring the unrelated queue-operation permission. Existing lecturer ownership checks remain.
- Existing admit/no-show/timetable policies beyond these contracts are not claimed as fully hardened.

Implementation starts after this log. Verification planned: raw-wire fixture workflows, failure/empty/
loading, keyboard/narrow selection, widths320/768/1440, existing211web checks, static gates/build,
strict landing source+pixels, gallery and per-page ten-dimension review before count changes.

## Implemented and individually reviewed

The pre-implementation gate above is retained as the original plan. All four pages now have
purpose-specific layouts rather than another shared-shell-only update:

- **Office directory:** searchable service-desk identity cards, real waiting/in-service/completed
  counts, inactive offices retained when the existing operation policy allows access. “Desks in your
  scope” does not falsely imply every permitted desk has an explicit assignment. Configuration is not
  presented as an open-now signal. Original schematic iconography replaces inappropriate stock photos.
- **Office console:** reception worklist, arrival/in-service filters, selected student/subject brief,
  deliberate transition review, one global Call next. Check-in is labelled “Check in & start service”
  because that endpoint directly returns `in_service`. Weekly windows retain Monday/Wednesday/Sunday
  and require both the active flag and active status for “Configured active”. Counts are last-loaded
  values, not a transport/liveness promise. Selection focuses the brief and offers a return link.
- **Rooms:** server search and paginator, room/location/capacity/type rows, explicit view-only versus
  updateable rooms, and a separate selected-room status form. Selecting a value never writes it.
  A rejected PATCH exposed an editor-unmount draft reset in the first browser pass; draft/error state
  was moved into the page and the rejection regression now passes. Unknown pagination is an error.
- **Teaching:** Monday-first seven-day agenda, chronological session strips, real teaching-term
  selector, focused inline create/edit/removal workspace. Forms use catalogue IDs, `type`, Sunday0,
  nullable room and `HH:mm:ss`; existing course and term stay immutable. Successful publication into
  another term follows that server-backed term and the saved weekday, after authoritative refresh,
  rather than hiding the new session. Rejected/invalid writes retain the draft; removal is reviewed.

All four use the new scoped `staff-services.module.css`: contained grids/rows, quiet warm-green
identity treatments, visible focus, responsive action workspaces and reduced-motion handling.
No global CSS, landing component, root layout or landing source change was made by this batch.
Page transitions remain short and purposeful; no fabricated booking, attendance, KPIs or drag/drop.

Centralized `staff-services.ts` adapters map the actual Laravel response names and verify mutation
identity/status/teaching fields. Existing `useOperator` serializes writes and performs authoritative
refresh; query identity guards prevent old room/term data becoming an actionable new-query result.
The generic read failure copy now says workspace, not queue. Controllers retain route permissions,
lecturer ownership and room update scope; directory scope is aligned with the existing office policy.
Room reads add a server-derived write capability, and teaching reads expose actual catalogues/terms.
No browser-only permission grant was introduced.

## Verification and evidence

- **256 unique fixture-backed web checks passed**: 235 in the combined visual/discovery/services/
  companion/operations/staff-services run (4.1 minutes), plus 21 existing layout checks (58.1 seconds).
  This is the previous 211 plus 45 new staff-services tests, not 256 new tests and not one combined run.
- After final copy/format cleanup, rebuilt and reran all 45 new tests plus the five discovery-state
  tests including strict landing isolation: **50/50 passed, 1.2 minutes**. No product changes after this
  verification. Logs are under `.cache/staff-services-pass/`; persisted summary is
  `staff-services-evidence.json`.
- The new suite covers 12 page/width captures (320/768/1440), four pending reads, four empty states,
  four scope failures, office search/windows/transitions/global selection/reason/double-click/incorrect
  success ID, narrow focus/return, room status-only payload/pagination/search/permission/failure-draft,
  and teaching Sunday/payloads/immutable fields/time validation/rejection/removal/catalogue/read-only/
  non-current-term publication. It does not claim backend permission enforcement from fixtures.
- Three supplemental teaching-editor captures passed focus, zero horizontal overflow and no page-error
  assertions at all three widths. The gallery embeds all **15** application captures. Desktop/tablet/
  narrow contact sheets and editor desktop/narrow captures were visually inspected. Native time fields
  fit; small-screen editing moves ahead of the agenda. Full-page screenshots include fixed navigation
  at the original viewport boundary; this is not navigation in document flow.
- Final production build, root lint, PHP syntax parser, API contract gate and both-client typechecks
  passed. **125 PHP files / zero syntax errors; 199 routes; 185 web / 82 mobile / 78 test call sites;
  62 role-permission pairs; zero orphans or reported contract problems.** Parsing is not PHP execution.
- Seven protected hashes are unchanged. Strict cold vs client-return landing: **1440×5065, zero
  differing channels**, after discovery/services/companion/operations AND staff-services CSS load.
  Staff CSS is loaded through client sign-in/navigation, not a new document. Each screenshot state
  still requires three identical frames, no masks or tolerance. Only the whole journey budget was
  expanded to 60 seconds for the additional role sign-in; the stabilization criterion stayed strict.
  Persisted evidence: `staff-services-landing-preservation.json`.

### Subjective ten-dimension review

Visual / usability / hierarchy / consistency / responsive / accessibility / interaction / performance /
CampusFlow relevance / originality. These are implementation-review estimates, not measured usability,
field performance, a WCAG certification or an assistive-technology study.

| Page | Scores | Mean | Review note |
|---|---|---|---|
| Office directory |8/9/9/8/9/8/8/8/9/8|8.4|Desk identity and scope are clear; intentionally no invented current visitor or live-open claim.|
| Office console |9/9/9/8/8/8/9/8/9/8|8.5|Student/subject/action separation works; long worklists and multi-operator races need deployment testing.|
| Room management |8/9/9/8/9/8/9/8/9/8|8.5|Permission and deliberate-save distinction are visible; search remains server-driven, not a fabricated complete local list.|
| Teaching timetable |8/9/9/8/8/8/9/8/9/8|8.4|Seven-day hierarchy and term-following avoid hidden sessions; narrow editor is deliberately vertical, not a compressed desktop grid.|

### Limits and remaining work

Three Laravel feature tests were added for office operation scope, room capability/status validation,
then teaching catalogue/Sunday creation/Saturday update. **Not executed:** PHP CLI, Composer/vendor and
live Laravel are unavailable. The production web preview has no live API on its configured backend
port; screenshots and browser workflows use explicitly test-only raw-wire fixtures. No production
records are represented. Browser evidence does not establish database transitions, transport delivery,
concurrency/idempotency, backend deployment RBAC, physical-device or cross-browser compatibility,
screen-reader support, GPS/camera, or native mobile behavior. Existing no-show/admission concurrency,
partial timetable time-PATCH validation against retained fields, and large-campus query optimization
remain backend follow-up, not implied as solved. The UI submits both teaching times.

This batch brings the expanded individual pass to **20/31 signed-in implementations**. All 12 student
pages, two shared pages and six staff pages are reviewed. The remaining **two staff and nine admin**
pages are not silently counted as complete; login's final audit and ancillary auth/status screens
remain separately tracked. See `web-page-tracker.md` and `staff-services-review.html`.
