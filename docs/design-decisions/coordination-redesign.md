# People, publishing and oversight — batch six

2026-09-16. **Pre-implementation gate.** Four canonical pages: staff dashboard, staff content,
admin dashboard and admin users. Completion remains20/31 until verified. Full PROMPT and scoped
Next CSS guide read. Previous dirty work preserved; seven protected landing hashes saved before edits.

## Audit before design

Staff dashboard currently leaks global pending students/counts, shows only open queues, has an empty
teaching array and loops “Open board” back to itself. Content sends unsupported building/pinned/
registration fields; controller creator fields do not match models and guards use the queue permission.
Admin users sends role_code rather than role, has incompatible paginator fields, incomplete staff
selection tied to the current user page, mixed role/profile saves and misleading deletion copy.
Admin dashboard labels configuration as live/open and uses unavailable analytics as empty charts.
Existing APIs and policies are the starting point, not an invented feature list. Backend changes will
be narrow contract/scope fixes with tests; no comprehensive concurrency/security certification.
PHP/Composer unavailable; Linux prerequisite download from php.new failed TLS (curl35). Boost is
already declared in composer.json; no dependency churn. Static parser checks are not runtime tests.

## Reference inspection and scores

Searches: Dribbble user/role permission management; content/CMS dashboard. Opened S/T again; reused
prior recorded visual inspections of S/R/N/D/Q. Re-inspected cached exact Terchera thumbnail. New
Chavin role-permission thumbnail and CMS UI thumbnail visually inspected. Exact Chavin shot resolved;
CMS exact shot/creator **Not available** (honestly attributed search thumbnail). New Syarif and Ranu
shot pages opened, but their artwork download failed and search images did not match: not counted as
visually inspected or selected. Unrelated image-search hits discarded, not attributed to those shots.

Scores: V/U/hierarchy/interaction/responsive/mobile/accessibility/type/relevance. Weights
15/20/15/10/10/10/5/5/10%. Responsive/accessibility numbers are subjective transfer estimates from
static references, not measured behavior or WCAG certification.

|ID|Source, title, designer|Studied strengths / weakness / adaptation|Scores; weighted|
|---|---|---|---|
|P|https://dribbble.com/shots/14908326-User-Role-Permission-Management — Chavin Wickramatunge|Grouped permission domains, separate role identity and save. Tiny dense checkboxes and flat grid; use explanatory role/scope workspace, not editable invented permission registry.|8/8/9/8/7/6/6/8/9;7.85|
|C|https://dribbble.com/search/cms — “CMS UI 🖥️” thumbnail; creator/exact shot Not available. CDN image identity 17603147/original-8051a577971929681b58a30893774f5d.jpg|Author/title/status ledger and separate activity context. Tiny text and unrelated metrics; use publication list and deliberate composer, reject revenue/comments/progress features.|8/8/9/7/7/6/6/8/8;7.65|
|S|https://dribbble.com/shots/25644823-Stride-Task-Management-Dashboard — Adhitya Putra/Hatypo|Task/status hierarchy and quiet contextual rail; no draggable server transitions, arbitrary productivity metrics or copied layout.|9/9/9/8/8/7/7/9/8;8.40|
|T|https://dribbble.com/shots/23673729-Terchera-Online-Appointment-Schedule-List — Fariz Al/10am Studio|Time/person/action separation, quieter filtering. Reject integrations/rescheduling and tiny schedule text.|8/9/9/8/8/7/7/8/9;8.30|
|R|https://dribbble.com/shots/20602523-Room-Booking-Dashboard-Admin — Adhitya Putra/Hatypo|Facility identity and grouping; not financial charts or invented availability.|9/8/8/8/7/7/6/9/8;7.95|
|N|https://dribbble.com/shots/17219721-Notification-settings-page-Untitled-UI — Jordan Hughes|Explanatory sections and controlled settings. No invented mutable role permissions.|8/9/9/8/8/8/7/8/8;8.30|
|D|https://dribbble.com/shots/17726302-Studly-Mobile-App-for-Students — Marina Shevchenko/Netguru|Schedule-led information hierarchy. Reject attendance/homework/payment capabilities.|8/9/9/8/8/9/7/8/10;8.60|
|Q|https://dribbble.com/shots/21221213-QMS-Queueing-Management-App — FlutterMate|Ticket and facility identity. Not measured staff-operator usability; no guaranteed waiting times.|8/9/9/8/8/9/7/8/10;8.60|

## Page-by-page comparisons and original directions

### Staff dashboard — S8.40 / T8.30 / D8.60 / Q8.60 → S + T
An action-first shift overview: pending requests with exact queue/office destinations, operational
scope directory, and today's teaching rail with campus-clock context. Real scoped counts, never
campus-wide student identities. Staff is not a miniature admin dashboard. Schematic original
CampusFlow icon accents only; do not obscure the work with a generic hero image. Empty scope means
no accessible operation, not zero campus activity. No writes directly on the overview.

### Staff content — C7.65 / T8.30 / N8.30 / S8.40 → C + N
Editorial workspace with events/notices switch, publication ledger and explanatory composer.
Separate identity, timing, audience and status. Preserve real capacity/audience capabilities by
connecting actual model fields; remove unsupported pin/building/registration toggles rather than
promise they work. Form submission is deliberate, retains draft on failure, and handles list-read
failure separately. Event changes and deletion must be scoped by the server, not guessed by UI.

### Admin dashboard — C7.65 / S8.40 / R7.95 / N8.30 → R + S
Campus oversight, distinct from staff service operations: large infrastructure index, queue load
snapshot, building status and audit ledger. Summary counts explain provenance. Metrics absent from
the backend are unavailable, not “no activity” charts. Navigation to configuration/analytics is real.
No fabricated coordinates, trend lines or healthy-system badge. Reduced-motion, lightweight CSS
emphasis rather than an animated wall of numbers.

### Admin users — P7.85 / N8.30 / S8.40 / R7.95 → P + N
People directory with server search/role/pagination, readable identity rows and contextual access
review. Retain keyboard-scrollable semantic table on narrow screens, not clipped columns. Separate
profile saving, role-change confirmation, password-reset review and deactivation; no combined
non-atomic role/profile promise. Temporary passwords appear only in a dismissible result dialog,
not a toast/log/storage. Staff assignments get actual eligible people/scope catalogues independent
of the user filter, with explicit capability caveats. Creation remains a focused accessible modal.

## Common review plan

New CSS module only; landing and global styles protected. Three widths320/768/1440, narrow editor
and role/assignment states, real raw-wire payloads, loading/empty/403/422, duplicate writes, confirmed
mutation identities, scoped destinations, paginator/filter resets and unknown data. Re-run previous
256 web cases (adapt structure assertions only when the redesign intentionally changes structure),
root checks/lint/build and strict landing pixels. Per-page ten-dimension review and self-contained
screenshot gallery precede tracker changes. Runtime Laravel, real devices and screen readers remain
explicit evidence limits unless actually available.

**Implementation starts after this record.**

Audit correction after model inspection: User uses SoftDeletes. Deactivation copy is retained, not changed to permanent deletion. Tokens are revoked on deactivation. Backend checks now reject self/last-active-admin suspension or deactivation, but concurrency hardening remains separate.

## Implemented page reviews

### Staff dashboard
Rebuilt as a shift overview, not the admin chart grid. The attention list links each pending request
to its real queue or office console (no `/staff` self-loop). Operational spaces and teaching are
separate; today's classes use the server campus-clock context without inventing a moving “now” badge.
Closed assigned queues remain reachable. Enabled-office copy explicitly means configuration, not
live opening hours. Backend scope now applies before exposing pending student identities or counts;
waiting means waiting, and served means recorded room admissions plus office completions. The same
existing permissions and scope policy are used, including the configured unassigned-staff fallback.

### Staff publishing
Editorial list + composer, with an independent announcements ledger and chronological event pages.
Only server-capable authored events expose edit/remove; notices are the current author's ledger.
Real creator/target-role/capacity fields are stored and validated; unsupported pin, building and
registration toggles were removed rather than left deceptively functional. Event editing now uses the
existing PATCH route. Forms retain failed drafts; identity/content/timing/capacity/audience checks
precede confirmation. Publishing feedback names the created item and explains that a new event can
appear on another chronological page. Deletion is reviewed and keeps errors in the confirmation.
Static guidance follows the ledger; an active narrow composer moves ahead of it and receives focus.

### Admin dashboard
Rebuilt around infrastructure links, room-demand snapshot, building status register and audit ledger,
not a staff service desk. Called/checked-in counts are labelled accurately rather than “inside”.
Capacity bars are a labelled ticket/configuration comparison, never physical occupancy. Raw audit
`subject_type` is normalized to the displayed entity. Unavailable backend analytics are not presented
as fabricated charts or a healthy/no-activity claim. Analytics, alerts, spatial configuration, users,
services and settings remain reachable. Server-generated timestamp marks this as a snapshot.

### Admin people and access
Search/role filters use the backend, reset pagination and clear selection; raw Laravel meta is
normalized centrally, never guessed. Contextual access review separates profile/status save from
an audited role-change review, reset-password review and deactivation review. Mismatched user IDs
cannot confirm success. Generated passwords are shown in a dismissible modal, not toasts, logs or
browser storage. Create/reset response handling retains errors and duplicate writes are locked.
Assignments use actual eligible staff/resource catalogues independent of the current directory page.
Unsupported queue scopes are no longer created; building/floor/room/office/course are verified by
the backend. Existing assignment flags are labelled with their real policy limits. Table column
proportions were polished after visual review to avoid single-character email wrapping. Narrow tables
remain explicitly keyboard-scrollable; the selected access workspace moves ahead of the table.

## Verification

- **302/302 unique fixture-backed web tests passed, 5.7 minutes**: the previous256 plus46 new tests.
  Command: `npm --prefix frontend run test:responsive -- layout.spec.ts web-visual student-discovery
  student-services student-companion campus-operations staff-services coordination.spec.ts` with
  Chromium153 via `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/tmp/chromium`, `LD_LIBRARY_PATH=/tmp/lib`.
- Following final table proportions, count/copy clarification and formatting, rebuilt and reran all46
  new tests, all21 layout tests and all5 discovery-state tests: **72/72 passed, 2.4 minutes**. These
  repeat checks are not additional unique tests. No further product edits after this verification.
- New tests cover12 principal page/width captures; four pending reads, four403 states, four empty
  states; exact staff destinations; honest admin/audit data; event create/edit/pagination/remove/
  view-only/invalid-time/failure retention; announcement audience; user create/generated password,
  separate role/profile writes, conflicts, reset, deactivation, filter reset; off-page assignment
  catalogue/removal; malformed meta, duplicate confirmation and wrong-success identity. Three
  editor-width tests also capture notices and selected account access.
- **27 embedded captures**: principal12, publishing composer3, notices3, account access3, assignments3
  and assignment form3. Six supplemental assignment captures passed no-overflow/page-error checks;
  modal bounds/focus checked at320/768/1440. Desktop/tablet/narrow principal sheets, narrow composer,
  selected access, notice ledger and assignment list/modal were visually reviewed. Fixed navigation
  appearing at the original viewport boundary in full-page images is expected. The narrow selected
  table can be horizontally scrolled to its action column; that is contained table scrolling, not
  document overflow.
- Existing layout tests passed unchanged, including keyboard modal behavior, navigation resizing,
  200% text and contained horizontal table access. Only two old dashboard headline expectations were
  updated to the deliberately redesigned copy. No assertions were removed to hide a regression.
- Final root check/lint/build passed:125PHP files parsed with0 syntax errors;199API routes;
  185web/82mobile/90test call sites;62role-permission pairs;0orphans/contract problems. Both web and
  mobile typechecks pass. Parser results do not execute PHP.
- Four Laravel tests added (two StaffTest, two AdminTest) for scoped dashboard data, author-owned
  content/real fields, profile-role separation/suspension/self-protection and assignment catalogues/
  unsupported type rejection. **Unexecuted** without PHP/Composer/backend dependencies.
- Landing: all seven baseline/final hashes identical. Strict cold/client-return screenshot comparison
  at1440×5065: **zero differing channels**, including the coordination CSS loaded on the staff
  dashboard during the existing client sign-in journey. Three identical captures per state, no masks
  or pixel tolerance. See `coordination-landing-preservation.json`.

### Failures found and resolved

The first new-suite run was interrupted at the command timeout after content cases failed: the
populated event list mixed `dateStyle/timeStyle` with the shared formatter's default date parts.
The Next error boundary replaced that screen. A local explicit-options date formatter fixed it;
shared hooks and landing were not changed. Two initial user tests used exact label-text lookup for
nested selects, which included option text; accessible combobox-name locators correctly target the
existing semantic controls. Seven other user workflows passed that initial partial run. The full46,
combined302 and final72 runs all passed afterward. No incomplete first run is reported as passing.

### Subjective ten-dimension quality review

Visual / usability / hierarchy / consistency / responsive / accessibility / interaction / performance /
CampusFlow relevance / originality. Performance and usability are review estimates, not benchmarks or
user research. Scores do not certify WCAG, assistive technology or cross-browser support.

| Page | Scores | Mean | Deliberate trade-off |
|---|---|---|---|
| Staff dashboard |9/9/9/8/8/8/9/8/9/8|8.5|Snapshot/task hierarchy over a false live-control centre; operations still open their own console.|
| Staff content |8/9/9/8/8/8/9/8/9/8|8.4|Vertical focused composer on narrow screens; no fictional scheduled publishing, pinned notices or registration toggle.|
| Admin dashboard |8/9/9/8/8/8/8/8/9/8|8.3|Infrastructure and audit context rather than visually impressive but unavailable analytics.|
| Admin users |8/9/9/8/8/8/9/8/9/8|8.4|Contained keyboard-scrollable table on phones; explicit independent operations rather than a misleading combined save.|

## Evidence limits and remaining scope

The Next production preview has no live Laravel API at its configured proxy destination. Browser
screenshots/workflows use clearly fictional test data. They do not establish deployed RBAC, database
transitions, race freedom, transport reconnect/delivery, real-device behavior, GPS/camera, native
mobile functionality or screen-reader compatibility. PHP prerequisites could not be downloaded in
this sandbox. Deactivation/last-admin guards are not row-lock concurrency hardening. Scope/catalogue
queries remain candidates for pagination/optimization at large campus scale. Publication failure
on an ambiguous network response is not backend idempotency; refresh before re-publishing. Legacy
content with no valid `created_by` is not automatically assigned to the current staff member and
requires a separate ownership-repair decision. Broad queue transition enforcement and partial
teaching-time PATCH behavior remain the already-recorded backend follow-ups.

**Expanded individual pass:24/31 signed-in pages.** All12 student implementations, two shared pages,
all8 staff implementations and two admin pages have been individually reviewed. Seven admin pages
remain: academics, alerts, analytics, campus, services, settings and spatial. Login's final audit and
ancillary auth/status screens remain separately tracked. No all-role completion claim.
