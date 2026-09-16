# Web workspace redesign — 2026-09-15

## Scope and protection

Improve web login and authenticated student/staff/admin workspaces. **Do not change the landing page.** Its page, components, root layout and global stylesheet are fingerprinted before work. New CSS Modules must be rooted in workspace/auth classes; no new global theme overrides. Preserve the previous responsive and mobile work. The shared kit may receive inert data attributes, but landing rendering must not change.

Audit: the web app has real role-specific APIs, charts, forms, tables and workflows. Its chrome, small headings, repetitive surfaces and plain login understate that functionality. Improve the desktop information hierarchy, not clone the phone tabs. Camera/live navigation stay mobile-only.

Read installed Next 16 CSS Modules guidance. Shared kit, role navigation, login, dashboards, map, alerts and responsive tests inspected before changes.

## Research gate — before implementation

Searched Dribbble for university portal/login/dashboard interfaces. Reopened all four pages below; visually reinspected matching Stride and QMS thumbnails and the UVER studio case-cover retained from mobile research. Student Portal page exposes image metadata, not a visually verified full-size UI. No designer assets are copied. See mobile-visual-redesign.md for original retrieval limitations.

Scores: hierarchy / desktop adaptability / CampusFlow relevance / implementation fit, subjective 1–10 engineering assessments.

| ID | Actual reference | Evidence | Score | Decision |
|---|---|---|---|---|
| S | https://dribbble.com/shots/25644823-Stride-Task-Management-Dashboard | Page plus matching thumbnail; contrasting navigation rail and grouped task content | 9/9/8/9 = 8.75 | Primary workspace reference; calm grouping and selected state, not its tiny task rows. |
| U | https://dribbble.com/shots/19285593-UVER-Universities-Aggregator-Mobile-App | Page + visually inspected studio case cover, https://phenomenonstudio.com/education-it-services | 9/8/9/9 = 8.75 | Editorial headings, campus imagery and search-first discovery; adapt beyond mobile cards. |
| Q | https://dribbble.com/shots/21221213-QMS-Queueing-Management-App | Page + matching thumbnail | 8/7/10/8 = 8.25 | Ticket and service priority; reject generic menu layout for desktop operations. |
| P | https://dribbble.com/shots/22740056-Student-Portal-Management-App | Page text/image metadata, no verified full-resolution UI | 8/8/9/8 = 8.25 | Conceptual student grouping only; not visual evidence or a copied layout. |

### Screen/pattern selection

| Screen or surface | Compared | Selected implementation direction |
|---|---|---|
| Login | U, S, P | U + S: illustrated campus welcome, focused form, password visibility, quieter demo disclosure. No inaccurate web-camera promises. |
| Student dashboard | U, P, S, Q | U + P: editorial welcome with campus artwork, next-class focus, real schedule and ticket information. |
| Staff dashboard | S, Q, P, U | S + Q: operational spotlight, service totals, pending students and assigned desk/room lists. |
| Admin dashboard | S, Q, U, P | S: campus snapshot and configuration shortcuts, stronger genuine chart/metric hierarchy. |
| Student map/route preview | U, S, P, Q | U: prominent search/discovery context; preserve actual map and route preview rather than substitute illustration. |
| Student queues/offices | Q, S, P, U | Q + S: large ticket/service identity and explanatory hierarchy; existing API actions retained. |
| Assistant | U, S, P, Q | U + S: distinct companion introduction, quiet conversation surface, no fake answers. |
| Timetable/rooms/events/notices | U, P, S | U + P: editorial headers and consistent legible content surfaces; existing filtering and views retained. |
| Staff queues/offices/content/timetable/rooms | S, Q, P | S + Q: operational headings, clear service context and legible records; no policy changes. |
| Admin alerts | S, Q, U | S + Q: severity filters, count summaries, condition-focused cards and labelled acknowledgement notes. |
| Admin management/analytics pages | S, P, Q | S: stronger sidebar, section hierarchy, metric and table surfaces; preserve CRUD/dialog logic. |
| Account/notifications | U, P, S | U + S: personal identity and readable activity; no optimistic notification-read success on failure. |

## Design direction

An ink navigation rail, warm neutral workspace, indigo selected states, generous white surfaces,
mint/amber accents, editorial page headings and large tabular metrics. Login/student welcome reuse
the original fictional campus illustration commissioned for mobile, explicitly decorative—not real
campus geography. Operational illustrations are restrained schematic decoration, never data charts.

Short route entrance and hover/press feedback only, disabled under prefers-reduced-motion. No new
animation dependency. Do not animate tables, continuously pulse metrics, invent trends or claim
connection health from static values. Preserve keyboard focus and existing responsive overflow regions.

## Verification plan

Both typechecks, lint, API/PHP gates, production build. Existing responsive tests plus populated web
fixtures for redesigned workspaces, login/password/error flows, alert filters and failed read actions.
Inspect desktop and narrow screenshots. Verify landing source hashes and before/after screenshot.
Fixtures stay in tests and visual review, never app runtime. Backend deployment/integration remains
separate from mocked browser presentation checks.

## Implemented result

[Open the self-contained screenshot review](web-visual-review.html). All captures are rendered
Next.js pages at 1440×1000, with clearly labelled test-only data. Click a capture to expand it.
The redesign is a new login and role-dashboard composition, focused improvements to map, service,
assistant and alert screens, and a scoped shell/header/surface treatment across the remaining signed-in
pages. It does **not** claim every CRUD form was individually rebuilt. Registration/password recovery,
landing and native code were not redesigned in this web pass.

- Original ~77KB campus WebP reused in login and the student welcome. A soft mask removes the
  illustration's hard rectangular edge. Staff/admin panels use decorative SVG symbols, not fake charts.
- New ink navigation rail, accessible current-page states, role context, larger page headers and
  tabular metrics. Existing routes, responsive tables, dialogs, measured native foundations and API
  permissions remain intact. No dependencies added.
- CSS Modules are rooted in workspace/auth classes. Shared primitives received only inert data
  hooks; their visual changes apply inside the workspace. Portal dialogs retain their existing styling.
- 260ms CSS route entrance, no perpetual metric animation, and reduced-motion rules. The assistant's
  programmatic scrolling also honours reduced motion. Its desktop composer fits the tested first viewport.
- Notification read failures retain unread counts and expose an error. Dashboard failures never show
  a fabricated zero-data success. Service history and assistant capability failures are distinguished
  from empty data. Alerts expose working severity filters and labelled notes; muting is not resolution.
- Map: fixed a misplaced intro, removed dead `/scan` and `/navigate` links, removed a decorative
  circle that could be mistaken for a real plaza, added keyboard building selection and a real empty
  state for buildings without published floor plans. Query-string destinations populate a route form.
  The form calls the existing centralized campus route API, with an explicit published origin anchor;
  it does not locate the browser, calculate a route client-side or start a live navigation session.
- Fixed the route preview's outdoor-only initial view so it no longer waits forever for an indoor plan.

### Important existing backend integration limitation

Inspection found `NavigationController::computeRoute` still returns the legacy `nodes`, `edges`,
`total_distance_m` shape. The centralized web route client requires the richer contract (`legs`,
`steps`, `transitions`, labelled origin/destination). This redesign **does not silently invent those
fields or patch routing logic**. Incomplete responses produce the existing explicit error and no route
visual. Browser tests cover both incomplete-response rejection and a valid outdoor-only contract.
A backend contract follow-up is required before real route previews can be certified. Actual auth,
mutations and realtime connectivity also require the deployed API; no test fixtures are shipped into
application runtime.

## Implemented scores

Subjective engineering review after inspecting screenshots, not user research or accessibility
certification. Ten dimensions: visual quality (V), usability (U), hierarchy (H), consistency (C),
responsiveness (R), accessibility (A), interaction (I), performance (P), CampusFlow fit (F), originality (O).
Map interaction is deliberately scored lower due to the backend contract limitation above.

| Screen / pattern | V/U/H/C/R/A/I/P/F/O | Mean |
|---|---|---|
| Login | 9/9/9/9/9/8/9/9/9/8 | 8.8 |
| Student dashboard | 9/9/9/9/9/8/8/9/9/8 | 8.7 |
| Staff dashboard | 9/8/9/9/9/8/8/9/9/8 | 8.6 |
| Admin dashboard | 9/8/9/9/9/8/8/9/9/8 | 8.6 |
| Campus map / route form | 8/8/8/9/9/8/7/9/9/8 | 8.3 |
| Room queue tickets | 8/8/8/9/9/8/8/9/9/8 | 8.4 |
| Office services | 8/8/8/9/9/8/8/9/9/8 | 8.4 |
| Assistant | 8/9/8/9/9/8/8/9/9/8 | 8.5 |
| Timetable | 8/8/8/9/9/8/8/9/9/8 | 8.4 |
| Operational alerts | 9/9/9/9/9/8/9/9/9/8 | 8.8 |
| Management table / shell pattern | 8/8/8/9/9/8/8/9/9/8 | 8.4 |
| Notifications / shared workspace | 8/8/8/9/9/8/8/9/9/8 | 8.4 |

Shared pattern scores are not claimed as separate bespoke reviews of every untouched management form.

## Final verification

- `npm run check`: pass; 125 PHP files parsed, 0 syntax errors; API/platform checks 0 problems;
  frontend and mobile TypeScript checks pass.
- `npm --prefix frontend run lint`: pass.
- `npm --prefix frontend run build`: pass, production preview served on `0.0.0.0:3100` via the
  existing same-origin API proxy. Existing lockfile-root/deprecation warnings remain nonblocking.
- Full Playwright suite with web and Expo previews: **133/133 pass** (21 prior web responsive checks,
  46 new web visual/interaction checks, 66 Expo regressions). New checks cover twelve screens at
  320, 768 and 1440px; login/reveal/error flow; notification failure; alert filtering/acknowledgement;
  three dashboard failure states; reduced motion; route contract rejection/valid outdoor preview;
  keyboard building selection and missing-floor empty state. The existing suite also exercises
  desktop/narrow tables, menus, modals, 200% text and public page responsiveness.
- `npm --prefix mobile run test:responsive`: **3/3 pass**.
- `git diff --check`: pass.
- **Landing preservation:** page, landing components, root layout and global stylesheet hashes
  unchanged from the start of this request (not reset to Git HEAD, which contains older responsive
  changes). At 1440×1000, full-page comparison with fixed time and reduced motion yielded **0 differing
  pixel channels**, both for a fresh load and client-side navigation from the new login. Evidence in
  [web-landing-preservation.json](web-landing-preservation.json).

Browser tests use deterministic fixtures and are not end-to-end backend or cross-browser certification.
Production users still need a reachable API to sign in and load workspaces. Native-device QA from the
mobile redesign remains a separate outstanding gate. No landing or native files were changed by this
web redesign.
