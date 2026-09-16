# Individual web pass — student discovery (2026-09-15)

## Scope / audit before implementation

Four individual screens: room directory, room details, campus events, announcements. This is the
first batch of the full page-by-page pass, NOT completion of every role page. See web-page-tracker.md.
Keep landing, global styles, native app and existing work untouched. Next 16 installed CSS Modules
guide read after restoring dependencies. All four source pages and relevant API controllers inspected.

Audit: room directory's free-first toggle is a no-op; building/type/capacity/accessibility request
parameters do not match the controller. Directory has no availability payload, so do not fabricate
free/busy flags. Detail page flattens identity, actual availability and schedule into generic cards.
Events lack discovery hierarchy and repeat equally weighted cards. Notices are an undifferentiated
feed and can show an empty success alongside a failed read. Registration must remain API-confirmed.

## Research gate (completed before final UI implementation)

Searches: Dribbble room booking dashboard/calendar; event discovery/dashboard; reuse the previously
recorded UVER and Stride references after reopening their pages. Sources below are real retrieved
pages. A page/metadata inspection is not claimed as full-resolution visual access.

Scores are subjective hierarchy / relevance / adaptability / usability (1–10), not user studies.

| ID | Source | Inspection and comparison | Score |
|---|---|---|---|
| R | https://dribbble.com/shots/20602523-Room-Booking-Dashboard-Admin | Page and matching Hatypo artwork visually inspected: separate summary, filters and records; reject owner revenue/charts for a student directory. | 9/9/9/8 = 8.75 |
| C | https://dribbble.com/shots/7268044-Dashboard-Calendar-Restaurant-Table-Booking | Page describes monthly overview, upcoming hour and detailed schedule; temporal hierarchy is useful, restaurant occupancy semantics are not. | 9/8/9/8 = 8.5 |
| E | https://dribbble.com/shots/3032476-Event-Dashboard | Page, palette and image metadata inspected; event discovery reference. Image search returned unrelated event software, excluded as visual evidence. | 8/9/8/8 = 8.25 |
| U | https://dribbble.com/shots/19285593-UVER-Universities-Aggregator-Mobile-App | Page reopened; prior visual inspection documented in mobile/web records. Search-first discovery, identity and selected filters; reject admissions-specific flows. | 9/9/9/9 = 9 |
| S | https://dribbble.com/shots/25644823-Stride-Task-Management-Dashboard | Page reopened; prior matching thumbnail inspection documented. Status grouping/adaptable rails; reject dense desktop rows on narrow screens. | 9/8/9/8 = 8.5 |

Research images are ignored scratch, never production assets.

## Per-page decisions

### Room directory — compare R, U, S, C → U + R

A split discovery workspace, with a labelled filter rail, prominent search and grid/list views. Room
identity gets a typographic tile and original illustrative icon, not fake room photos. Cards distinguish
capacity, room type, admission and observed queue state. Preserve API paging, show which loaded results
local filters affect. Remove unsupported free-first claim; link to actual detail availability. Use
controller-supported `q`, `type`, `per_page`, `page`; the former non-working building/accessibility controls are removed rather than implying server support.
Capacity is explicitly a filter on the loaded page. Admission offers any policy or queue-required,
because the controller does not support a false-only admission filter. Search changes reset pagination.

### Room detail — compare C, R, U, S → C + R

A room identity masthead, a primary availability/next-step panel, a daily agenda and weekly schedule.
Facilities/location move into a quieter side column. Use the returned daily availability/occupancy,
not client-calculated capacity or fake progress. Show closed separately from busy. No fictitious floor
plan/photography; use original symbolic room art. Existing join action remains backend-controlled.

### Events — compare E, U, C, S, R → U + S hierarchy; E discovery concept

An editorial discovery view with the next chronological event featured, category filters, date-led
cards, details disclosure and a personal registration view. Feature only an actual returned event,
never an invented recommended event. Original geometric event artwork is decorative, not a photograph
of an organiser's event. Registration/cancellation wait for the API and surface inline errors. Counts
refer to the loaded view, not the entire campus; past events cannot be registered for.

### Announcements — compare S, U, R, E → S + U

A campus noticeboard: pinned notices separated from the chronological feed; urgency-labelled side
filters, text search, compact metadata and expandable full notices. A failed read must not say there
are no notices. Expiry dates and author/audience come only from the payload. Status is text as well as
colour. Do not invent read receipts, bookmarks, subscriptions or notification counts.

## Verification plan

Typechecks/lint/production build; API/PHP gates; populated, empty and failed fixtures; each screen at
320, 768 and 1440px. Exercise filters, directory page changes, grid/list switch, notice disclosures,
event registration rejection/success, room join rejection. Inspect actual screenshots; score ten
quality dimensions after fixes. Snapshot/checksum protect the landing. Browser fixtures are not real
backend integration or cross-browser certification. Further role pages remain tracked separately.

## Reference assessment notes

Primary visually grounded references are R (Adhitya Putra / Hatypo, Room Booking Dashboard Admin),
U (Phenomenon Product / Phenomenon Studio, UVER Universities Aggregator), and S (Adhitya Putra /
Hatypo, Stride Task Management). C is Bor Kolar’s Calendar / Restaurant Table Booking; E is Gil
Huybrecht’s Event Dashboard. C and E are supplementary author-description/concept references, not
claims of full visual inspection. No event image from the mismatched search was used.

The initial comparison above uses concept-fit scores. Supplementary weighted assessment uses the
PROMPT weights: visual 15%, usability 20%, hierarchy 15%, interaction 10%, responsiveness 10%, mobile
10%, accessibility 5%, typography 5%, relevance 10%. These are subjective transfer estimates from
available visuals, **not** measured accessibility or interaction tests of the original products.

| Reference | V | U | H | I | R | M | A | T | C | Weighted fit |
|---|---|---|---|---|---|---|---|---|---|---|
| R | 9 | 8 | 9 | 7 | 7 | 6 | 6 | 9 | 9 | 7.95 |
| U | 9 | 9 | 9 | 8 | 9 | 9 | 7 | 9 | 9 | 8.80 |
| S | 9 | 9 | 9 | 8 | 8 | 7 | 7 | 9 | 8 | 8.40 |

C/E weighted visual scores: **Not available**. Their author descriptions contribute conceptual
comparison only. For all four pages the three visual comparisons are R/U/S; C adds chronological
organisation and E adds the event-discovery problem framing. Original CampusFlow treatments are not
copies of a source screenshot.

## Implemented and reviewed

- Directory: original campus artwork masthead, symbolic room tiles, grid/list switch, search, real
  controller-supported type/admission filters, correctly normalised Laravel pagination, explicit
  loaded-page seat filtering, unknown queue-read state, direct room/route links.
- Detail: room identity, authoritative availability headline/open status, today/week schedule,
  occupancy/admission sidebar, facilities, accessibility information, server-confirmed queue action.
  A positive session count with an empty `busy` array no longer crashes. Closed is not called busy.
- Events: date-led featured event from the actual loaded list, personalised registration view,
  dynamically derived categories (including the backend’s hackathon category), chronological local
  filtering, full description disclosure, scoped counts and API-confirmed registration/cancellation.
  Missing registration counts are not zero; legacy backend `is_registered` is recognised. No automatic
  reminder is promised. Explicit refresh discards local write confirmations and rereads the server.
- Notices: editorial bulletin, real pinned section when supplied, chronological feed, priority rail,
  local full-text search, native keyboard disclosures, expiry/audience metadata and pagination.
  No read receipts, bookmarks or permission targeting are fabricated.

Visual inspection: all four full desktop and 320px screenshots reviewed. Fixed a duplicated date in
both event poster and date stamps caused by `formatDate` merging default date fields. The narrow event
poster now has its own compact arrangement. Collapsed mobile room filters keep search accessible in
the first viewport; all filters remain available behind an expanded, keyboard-operable control. Shortened
an admission placeholder that was clipping in the desktop rail. 768px reflow tested without overflow.

### Implemented quality gate (subjective self-review)

Order: visual quality / usability / hierarchy / consistency / responsiveness / accessibility /
interaction / performance / CampusFlow relevance / originality. Manual screen-reader and real-device
certification remain outstanding; accessibility scores reflect semantics, visible focus, keyboard and
reduced-motion checks only.

| Screen | Scores in the order above | Mean |
|---|---|---|
| Room directory | 8 / 8 / 8 / 8 / 8 / 8 / 8 / 9 / 9 / 8 | 8.2 |
| Room detail | 8 / 8 / 9 / 8 / 8 / 8 / 8 / 9 / 9 / 8 | 8.3 |
| Campus events | 9 / 8 / 9 / 8 / 8 / 8 / 8 / 9 / 9 / 8 | 8.4 |
| Announcements | 9 / 9 / 9 / 8 / 8 / 8 / 8 / 9 / 9 / 8 | 8.5 |

### Validation evidence

- Production build, frontend lint, both client typechecks, 125 PHP syntax checks and API contract
  audit pass (199 routes / 185 web calls / 82 mobile calls / 67 existing contract test calls / zero
  contract problems). No backend files changed in this batch.
- **99/99 browser checks passed together in 2.7 minutes**: 32 new checks (27 page/interaction
  checks + 5 state/isolation checks), plus 67 prior web checks. Browser checks cover 320/768/1440 widths, empty/error/retry, Laravel pagination,
  filtering, keyboard disclosures, queue rejection/confirmation, idempotency payload, event
  rejection/registration/cancellation/refresh, plaintext notice rendering, reduced motion and loading.
- Landing source hashes still match both the start of this batch and the previous protected source
  evidence. Cold landing versus landing after client navigation through the discovery workspace and
  logout has **zero differing pixel channels** at 1440×1000. This is a new CSS-isolation comparison,
  not a claim that an unavailable historical screenshot was rerun. Evidence in
  `student-discovery-landing-preservation.json`.
- Review screenshots use controlled API fixtures. They do not certify a deployed backend, real
  registration capacity enforcement, WebSocket connectivity, cross-browser or native mobile behaviour.
  The pre-existing incomplete backend navigation-response contract remains documented in the prior
  web report. Room/event links now use canonical map URLs; old `/map` paths already had a redirect.
- No native mobile code changed in this batch; its earlier 66 browser checks were not rerun here.

Gallery: `student-discovery-review.html` contains four desktop/narrow pairs. Tracker: only these four
pages are marked individually redesigned/reviewed in this expanded pass. Remaining student/shared,
staff and admin pages are explicitly pending. This is **not** delivery of the entire all-role redesign.

Screenshot-harness correction: immediate full-page captures occasionally caught an unsettled compositor frame. The isolation test now requires two identical successive captures for each state before comparing them, as standard visual assertions do. Three consecutive isolated runs and the final 99-test run passed with zero differing channels. No landing source was changed to stabilise the test.
