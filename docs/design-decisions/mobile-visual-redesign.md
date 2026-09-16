# Mobile visual redesign — 2026-09-15

## Audit and scope

Redesign login; student Today/Scan/Map/Line/More; staff Line/Desk/More; admin Monitoring/Alerts.
The installed Expo 57 docs were read. Shared tokens and every target screen were inspected.
Current screens have useful backend functionality but mostly identical headings, flat cards,
small icons and developer-oriented copy. Keep existing role trees, API clients, mutations,
loading/error handling, safe areas, measured responsive rows and font scaling. No backend
schema or new API is required. Repair misleading success/empty-state copy when encountered.

## Research gate: search → inspect → compare → select

Search queries: Dribbble student portal login/mobile dashboard; QR scanner/queue management;
mobile monitoring/task dashboard; university map. Pages below were opened on 2026-09-15.
Scores are engineering fit scores (hierarchy / mobile usability / relevance / adaptability),
not claims of user testing. A page-text inspection does not imply access to its full-resolution art.

| ID | Real source | Inspection and score | Selection |
|---|---|---|---|
| A | https://dribbble.com/shots/22455832-Student-Portal-Login-UI | Page text + linked image metadata; 8/8/9/8 = 8.25 | Login's dedicated welcome/identity area; do not copy assets. |
| B | https://dribbble.com/shots/22740056-Student-Portal-Management-App | Page text + linked image metadata; 8/8/9/8 = 8.25 | Student grouping reference, not a screenshot reproduction. |
| C | https://dribbble.com/shots/24316631-Student-Portal-UI-Design | Page describes recognisable icon grid and student profile; 8/8/9/9 = 8.5 | More's grouped services and identity. |
| D | https://dribbble.com/shots/21221213-QMS-Queueing-Management-App | Page inspected; matching QMS browse thumbnail visually inspected; 8/9/10/8 = 8.75 | Ticket hierarchy and service grouping, not the generic menu layout. |
| E | https://dribbble.com/shots/15283745-Mobile-App-Qr-scanner-concept | Page/palette inspected, animation not available; 8/8/9/8 = 8.25 | Focused scanner framing; no claimed animation reproduction. |
| F | https://dribbble.com/shots/22423785-UX-Design-Event-App-Registration-via-QR-Code | Page explicitly describes prominent scanner and validation states; 8/9/9/9 = 8.75 | Scan's frame → validation → confirmed position sequence. |
| G | https://dribbble.com/shots/25644823-Stride-Task-Management-Dashboard | Page and matching browse thumbnail visually inspected; 9/7/8/9 = 8.25 | Status-first operations grouping; reject desktop density on phones. |
| H | https://dribbble.com/shots/19285593-UVER-Universities-Aggregator-Mobile-App | Page and studio case-cover image visually inspected (https://phenomenonstudio.com/education-it-services); 9/9/9/9 = 9 | Primary: editorial headings, campus imagery, rounded search, prominent selected state. |

Unavailable: https://dribbble.com/shots/16577616-Task-manager-responsive-dashboard-design and
https://www.behance.net/gallery/13422535/Social-Student-App-IPHONEANDROID returned missing pages.
Direct Dribbble CDN downloads failed. Image search for A returned a **different** admission portal:
visually inspected and rejected (5/5/6/5); not attributed to SaulDesign. B image search returned an
avatar, not a UI reference. Source images stay in ignored research scratch, never in production.

### Per-screen shortlist and decision before implementation

| Screen | Candidates compared | Selected direction |
|---|---|---|
| Login | A, B, H | H's imagery + A's welcome hierarchy; original campus illustration, visible sign-in form, password reveal; demo accounts behind disclosure. |
| Today | B, C, D, H | H + B: editorial greeting, campus day card, next-class spotlight, schedule timeline and shortcuts. |
| Scan | E, F, D | F + E: dark framed camera, subtle scan sweep only while focused/active, numbered instructions, expandable manual entry. |
| Map | H, B, C, E | H: search-first discovery with an actual-coordinate building overview, building cards and location context. No fictional basemap or hard-coded destination. |
| Student Line | D, F, G, H | D: large ticket identity, state rail, clear next action, distinct open-line cards. |
| Student More | C, B, H | C + H: account card, grouped icon rows and a visually distinct assistant entry. |
| Staff Line | D, G, H, B | G + D: operational header, compact KPI strip, current ticket prominent, clear call/open actions. |
| Staff Desk | D, F, G | F + G: identity-check surface, verification result and action inbox; no cosmetic approval before API confirmation. |
| Staff More | C, G, H | C: account identity + notification inbox + separate sign-out. |
| Monitoring | G, D, H, B | G: snapshot time and alert state first, queue/office metrics, real-value summaries; no invented charts/trends. |
| Alerts | G, F, D | G + F: severity-led cards, functioning filter chips, acknowledgement distinguished from resolution. |

## Original CampusFlow visual direction

“Your campus, in motion”: ink/indigo mastheads, warm off-white canvas, lilac and mint icon tiles,
restrained signal amber for wayfinding, generous 22px surfaces, large tabular ticket/metric type.
Commission an original AI-generated **fictional campus illustration** for decorative login/Today
use; never show it as the real campus map. Decorative artwork has no operational meaning.

Motion: short focus-triggered entrance (opacity/translate), subtle press feedback, native stack
transitions, scan sweep only while permission granted + focused + scanning. Respect OS reduced
motion, stop listeners/loops on blur/unmount, don't animate every card or delay a primary action.
No autoplay carousel, endless background animation, fabricated queue progress or fake live badge.

## Verification plan

Both client typechecks; PHP/API separation gate; Expo web export; browser render tests of all 11
screens at phone/tablet/landscape widths, populated + error/empty fixtures, functional login,
password visibility/disclosure, manual scan validation, room filtering and alert acknowledgement.
Fixtures are tests only. Inspect screenshots and publish per-screen review scores after fixing
issues. Native camera, keyboard, screen-reader and device-motion QA remain a physical-device gate.

## Implemented review and evidence

All eleven target screens are implemented. The self-contained
[visual review gallery](mobile-visual-review.html) embeds actual 390×844 Expo Web captures from
`frontend/tests/responsive/mobile-visual.spec.ts`. These are **test fixtures, not live campus data**.
The reviewed viewport is only the top of each scrollable screen. Research art is not shipped;
`mobile/assets/images/campus-welcome.webp` is original generated decorative art (1100px, ~77KB).

Subjective engineering review: hierarchy / mobile usability / product relevance / consistency.
These scores describe the inspected implementation, not user-study results or accessibility
certification. Native-device checks below remain necessary.

| Implemented screen | H / U / R / C | Mean | Evidence and remaining qualification |
|---|---|---|---|
| Login | 9 / 8 / 9 / 9 | 8.75 | Art and sign-in visible at 390×844; reveal, disclosure and rejected-login flow checked. Short phones scroll. |
| Today | 9 / 8 / 9 / 9 | 8.75 | Next-class spotlight, functioning route shortcuts and timeline; removed unsupported greeting emoji after screenshot review. |
| Scan | 9 / 8 / 9 / 9 | 8.75 | Framed permission state, manual disclosure and API-confirmed success/error; camera hardware pending. |
| Map | 8 / 8 / 9 / 9 | 8.50 | Real-coordinate schematic plus building list alternative; no tile basemap or route fabrication. |
| Student Line | 9 / 8 / 9 / 9 | 8.75 | Large ticket, textual actual state, estimated wait and distinct actions; no invented progress or live-update promise. |
| Student More | 9 / 8 / 9 / 9 | 8.75 | Account identity, assistant feature and grouped campus/account links. |
| Staff Line | 9 / 8 / 9 / 9 | 8.75 | Service snapshot and prominent current ticket; actions preserve server authority. |
| Staff Desk | 8 / 8 / 9 / 9 | 8.50 | Identity lookup and action inbox; returned student record checked with fixtures. |
| Staff More | 8 / 8 / 9 / 9 | 8.50 | Profile, department and unread inbox; failed notification reads remain visible. |
| Monitoring | 9 / 8 / 9 / 9 | 8.75 | Timestamped snapshot, service metrics, alert summary; unavailable data is not an all-clear. |
| Alerts | 9 / 8 / 9 / 9 | 8.75 | Textual severity, working filters and API-confirmed acknowledgement, distinct from resolution. |

### Functional and motion decisions made during implementation

- Building selection uses the existing building-detail endpoint and its actual room membership.
  Backend room text search matches only room names/codes, so it is **not** used as a substitute
  for building membership. Partial building names also expose matching building choices.
- Search is debounced 250ms. `useLoader` rejects superseded responses, verified with a deliberately
  delayed old request; room results cannot be overwritten by an older query.
- Queue check-in closes at the backend's absolute deadline. Removed the old ineffective timer
  that rerendered without advancing its countdown. Admission eligibility remains API-controlled.
- 260ms focus entrances, faded tab changes and native detail-screen transitions respect reduced
  motion. Press feedback changes opacity rather than scaling. Scanner sweep runs only in the
  focused, permission-granted scanning view; its loop is cleaned up. Preference lookup defaults
  conservatively to no motion, including when lookup fails.
- Tab icons use selected-state backgrounds with labels; safe-area ownership, measured wrapping
  and existing keyboard avoidance remain intact. Header eyebrows can wrap at larger font sizes.
- Mutations are never presented as successful before the API responds. Alerts are acknowledged,
  not described as resolved. Failed dashboard/notification reads have explicit error/retry states.

### Checks run after the redesign

- `npm run check`: **pass** — 125 PHP files; API/platform separation with 0 problems; both
  frontend and mobile TypeScript checks.
- `npm --prefix frontend run lint`: **pass**.
- `npm --prefix mobile run test:responsive`: **3/3 pass** — native sizing-policy calculations,
  not screenshots from native hardware. Existing module-type warning remains nonblocking.
- `EXPO_PUBLIC_API_URL=/api/v1 npx expo export --platform web` in `mobile`: **pass**.
- Full Playwright responsive suite: **87/87 pass** — 21 existing web checks, 5 existing Expo
  responsive checks and 61 redesign checks. Eleven screens at widths 320, 390, 768 and 844
  (844×390 landscape); populated fixtures, data-failure states, filtered-empty alerts, password
  reveal/disclosure/rejected login, manual QR validation, building room selection, alert
  acknowledgement, staff lookup, search races and both motion preferences.
- `git diff --check`: **pass**.

Browser tests are presentation/integration-contract checks with mocked API responses, **not**
end-to-end backend validation. Camera permission/hardware, native keyboard/notches, secure storage,
OS font scaling, screen readers, location fixes, native-stack motion and real mutation flows still
require iOS/Android device or emulator QA. No claim of release certification is made.

### Preview

The mobile preview serves the real Expo export, without authentication bypass or fixture data:

```sh
cd mobile
EXPO_PUBLIC_API_URL=/api/v1 npx expo export --platform web
# Existing backend defaults to http://127.0.0.1:8001; override when necessary.
API_PROXY_TARGET=http://127.0.0.1:8001 npm run preview:web
```

It binds `0.0.0.0:3101`, accepts the preview host and proxies all API methods same-origin.
The live login does not require a backend; signing in and loading role data do. Missing backend
connections produce an explicit 502 API-unavailable response instead of silently serving mocks.
Native builds still need their normal device-reachable `EXPO_PUBLIC_API_URL` configuration.
