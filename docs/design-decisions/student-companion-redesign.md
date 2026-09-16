# Individual web pass — queues, assistant, account and notifications

Date: 2026-09-16. Third batch, four canonical pages (account/notifications shared by resident roles).
Landing source, root layout, global CSS and native mobile are protected. Existing dirty work retained.
Installed Next CSS Modules guide read before implementation.

## Pre-implementation research gate

Searched Dribbble for AI conversation/sidebar interfaces and account/notification settings. Opened
source pages and visually inspected matching results. Historical references are explicitly reused,
not claimed as new research. Scores estimate transfer to CampusFlow, **not measured usability of
source products**. V/U/H/I/R/M/A/T/C = visual/usability/hierarchy/interaction/responsive/mobile/
accessibility/type/relevance; weights 15/20/15/10/10/10/5/5/10 percent.

| ID / reference | Inspection, transferable strength and limitation | Scores | Weighted |
|---|---|---|---|
| A — [AI assistant — Untitled UI](https://dribbble.com/shots/24565263-AI-assistant-Untitled-UI), Jordan Hughes | Page + matching-title thumbnail visually inspected. Focused welcome, useful prompts, clearly separated turns, composer. Thumbnail cannot certify small text or keyboard interaction. Adapt to a full-page campus transcript, not copy a floating modal or unsupported agent capabilities. | 8/9/9/8/8/8/7/8/9 | 8.40 |
| B — [Botly AI Chatbot Dashboard, Mobile](https://dribbble.com/shots/22099914-Botly-AI-Chatbot-Dashboard-UI-Templates-Mobile), Tran Mau Tri Tam | Page + two matching images (8842661/8842662) inspected. Selected navigation, soft canvas and mobile drawer hierarchy. Actual shot is bot **management**, not a chat transcript: reject earnings, subscriptions, charts, childish 3D mascot and upsell. | 8/7/8/7/8/8/6/8/6 | 7.40 |
| N — [Notification settings page — Untitled UI](https://dribbble.com/shots/17219721-Notification-settings-page-Untitled-UI), Jordan Hughes | Page + matching-title thumbnail inspected; mobile/desktop section/divider hierarchy. A settings screen, **not an inbox**; use grouping only, reject invented delivery toggles. Small thumbnail limits type inspection. | 8/9/9/8/8/8/7/8/8 | 8.30 |
| Q — [QMS Queueing Management App](https://dribbble.com/shots/21221213-QMS-Queueing-Management-App), FlutterMate | Reopened page; reuse prior matching-thumbnail visual inspection documented in service pass. Facility → ticket → monitoring, large state identity. Reject unsupported appointments and guaranteed live position. | 8/9/9/8/8/9/7/8/10 | 8.60 |
| S — [Stride Task Management Dashboard](https://dribbble.com/shots/25644823-Stride-Task-Management-Dashboard), Adhitya Putra / Hatypo | Reopened page; prior matching-thumbnail visual inspection reused. Quiet history rail, task/state hierarchy. Reflow density, no fake progress or project controls. | 9/9/9/8/8/7/7/9/8 | 8.40 |
| U — [UVER Universities Aggregator](https://dribbble.com/shots/19285593-UVER-Universities-Aggregator-Mobile-App), Phenomenon Product / Studio | Reopened page; prior page/studio-cover visual inspection reused. Search-first discovery and clear mobile selected state. Reject admissions workflows. | 9/9/9/8/9/9/7/9/9 | 8.80 |
| R — [Room Booking Dashboard Admin](https://dribbble.com/shots/20602523-Room-Booking-Dashboard-Admin), Adhitya Putra / Hatypo | Reopened page; prior visual inspection reused from discovery pass. Room identity/action/list grouping; reject owner revenue and booking KPIs. | 9/8/8/8/7/7/6/9/8 | 7.95 |

Also inspected the text of [Minimal Sidebar for Botly](https://dribbble.com/shots/22059096-Minimal-Sidebar-for-Botly-AI-Dashboard).
Direct image download failed; search returned unrelated artwork/avatar. **Excluded from visual scoring
and selection**. The separately inspected Botly Mobile shot above is not passed off as that sidebar.
Reference artwork is research-only; none enters the shipped UI.

### Room queues — compare Q / S / U / R → Q + R

Queue selection board and personal ticket are different jobs. Make the selected ticket a prominent
number/state panel with factual next steps, actual people-ahead/estimate, capabilities and refresh.
The searchable board uses room identity, open/full conditions and anonymous counts; no fabricated
queue position, reservation guarantee, capacity progress or countdown based on average wait.
Responsive order: personal ticket first, then board. Terminal ticket is a receipt, not a ban on joining.

### Assistant — compare A / B / S / U → A + S, B only for mobile navigation separation

A dedicated conversation workspace, not a KPI dashboard. Warm welcome, capability-backed starting
prompts, a full transcript, visible composer, and quieter conversation library. Collapse library/tools
on narrow screens. Do not invent campus answers, fixed room codes, event/location capabilities or
model/provider labels. Keep actual metadata/data discoverable, but secondary to the response.
Deliberately lock open/new/delete/send against one another; retain drafts and disclose ambiguous failures.

### Account — compare N / B / U → N + U

Identity masthead and readable section navigation. Personal information, password security and
server-provided access each have a different purpose. Read-only identifiers are not editable fields.
Forms validate actual backend constraints; exact confirmation is required; password success ends this
session because the server revokes every token. Preserve separately supplied assignments and permissions.
No fake browser notification token or success toast for an unimplemented push provider.

### Notifications — compare N / S / A → S + N

An activity inbox with divider-separated messages, explicit unread status, type/time, independent
read/open controls and global unread total. Search/unread filtering is explicitly this loaded page;
server pagination remains accessible. Delivery note reports connection state, never “always live”.
Role-aware destination links only to real pages; unknown types remain readable without invented links.
Failure must never masquerade as “all caught up”. Serialized mutations preserve unread on rejection.

## Backend-first findings and planned safeguards

- `/me/notifications` binds **MeController**, not legacy EngagementController. Envelope is correct;
  pagination uses current_page/last_page and must be normalized. Individual/global reads return unread.
  `/me/devices` is explicitly a stub, not browser push delivery.
- Profile accepts name<=255, phone<=30, department<=120. Use confirmed response to update only profile
  fields in auth context, not a fallible second `/me` refresh that silently clears the principal.
  Password requires `confirmed`, min **8**, and deletes all tokens. Preserve grants/scopes.
- Active room ticket is a raw row; hydrate by ID. Join/replay returns a **full view directly**, not
  `{ticket: fullView}`. Normalize centrally, preserve ambiguous-retry idempotency, obtain consented
  real location only when required; never send an invented GPS fix. Terminal/capability states win.
- Assistant chat returns `message.metadata` plus **suggested_actions**; history nests messages inside
  `conversation`. No guaranteed provider/model/latency. Use real contracts and safe web destinations.
  Chat max1000. History max30 as supplied, not arbitrary client truncation. Stored history lacks saved
  action payloads in current backend; do not fabricate them when reopening a conversation.

## Validation plan (not yet completion evidence)

Four pages at320/768/1440, each success/error/empty; all resident roles for shared pages. Contract-shaped
fixtures for password confirmation/relogin, profile rejected/confirmed response, notification pagination
and read failures, queue raw active/full join/replay/proximity/capabilities/terminal/concurrency, assistant
nested history/suggested actions/unsafe links/draft recovery/pending locks. Run prior131 regressions,
root checks/lint/build, inspect screenshots and score ten dimensions. Strict protected hashes and stable
cold/client landing pixel comparison after all new CSS loads. Tracker stays8/31 until verified.

Additional verified audit finding: Next config redirected `/account` and `/notifications` into the
student-only layout, despite real shared implementations and staff/admin shell links. Removed just
those two redirects; preserved student aliases. Shared links now remain on shared routes. Browser-local
confirmed read events refresh other mounted inbox surfaces, so the shell badge/popover stays in sync;
failed reads publish no event. All network traffic still uses the centralized API client.

## Review-driven corrections and test history

- Initial38 new tests:27 passed;10 assertions accidentally matched Next's empty route-announcer alert,
  and one disclosure test toggled an already-open desktop library. Scoped the alert assertions to
  nonempty feedback and set the intended narrow viewport. All38 then passed (43.9s).
- Visual inspection—not overflow assertions—found squeezed identity/room text columns at320px and
  a broken-word send label. Replaced narrow flex identities with explicit icon/content grids, made
  the send action full-width, compacted the mobile library and offered two capability-backed starter
  prompts on narrow screens (all tools remain available in the disclosure). Added text-column width,
  send-height and composer-position checks. Actual service counts were not changed for appearance.
- Added five checks for shell badge synchronization, form locking, independent assistant-library/tool
  errors, complete long data and ticket loading/history errors:43 new checks total.
- First combined run:170/174 passed. Three legacy assistant assertions still expected the superseded
  welcome/composer labels; updated those labels while keeping the existing viewport requirement.
  Corrected that older fixture's tool IDs to the actual registry IDs.
- Landing comparison once differed only in photographic raster channels (mostly1 level, max17),
  with no source edits; two immediate strict reruns passed without application changes. Strengthened
  the existing compositor readiness helper from two to **three identical consecutive captures** per
  state. The final comparison still requires exactly **zero differing channels**, with no masks or
  tolerance. Do not interpret a transient headless-raster mismatch as an authorized landing edit.

Final principal audit: `/me` returns platform-filtered permissions in its envelope, while `User`
contains role grants. The centralized auth read now prefers that supplied session list (legacy shapes
still fall back to the supplied user list). A44th new check verifies a one-permission web session does
not expand back to the broader user grants after a confirmed profile update. This is display/session
state correctness; Laravel remains the authorization boundary.

## Final implementation and screen review

- **Room queues:** searchable room board plus a separate personal ticket/receipt; real line figures,
  clear status instructions, location consent, idempotent join/retry, deliberate cancellation,
  authoritative arrival controls and independently retryable history. No fictional ticket barcode.
- **Assistant:** conversation library, capability-backed starters, full transcript, safe actionable
  replies and visible composer. Opening/sending/deleting cannot overwrite one another; failed drafts
  survive. Narrow library is collapsible and the send label stays on one line. Full response data and
  metadata are available through disclosures, not silently truncated to six fields.
- **Account:** identity masthead, section navigation, separate personal/security/access workflows;
  real email/registration identifiers are read only. Password confirmation and session revocation
  match the backend. Profile success updates only confirmed profile fields, retaining session grants
  and separately supplied scopes. No invented last-login time or fake browser push registration.
- **Notifications:** message-oriented inbox rather than a settings-card grid; explicit read/unread,
  local filtering, real pagination, global read-all and role-safe destinations. Other mounted inbox
  surfaces refresh after confirmed reads. Disconnected/push-unavailable wording is explicit.

Inspected desktop, tablet and narrow captures, plus assistant reply and staff account states. Improved
narrow text compression and composer wrapping before final capture. Reused small existing campus icons
where functional; no reference artwork, fake photos, QR/barcodes or unnecessary large images on these
utility screens. Motion is limited to brief transcript entry and interaction states, disabled for
reduced-motion preference. Full-page screenshots can place fixed navigation at the capture viewport
boundary; that is a capture artifact, not a second navbar in document flow.

### Ten-dimension self-review

Subjective review of the **implemented screens**, not a user study, benchmark or accessibility certification.

| Screen | Visual | Usability | Hierarchy | Consistency | Responsive | Accessibility | Interaction | Performance | Campus relevance | Originality | Mean |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Room queues | 8 | 9 | 9 | 8 | 8 | 8 | 8 | 9 | 10 | 8 | **8.5** |
| Assistant | 8 | 8 | 9 | 8 | 8 | 8 | 9 | 9 | 9 | 8 | **8.4** |
| Account | 8 | 9 | 9 | 8 | 8 | 8 | 8 | 9 | 9 | 8 | **8.4** |
| Notifications | 8 | 9 | 9 | 8 | 9 | 8 | 8 | 9 | 9 | 8 | **8.5** |

## Final verification

- **175/175 web checks passed together in4.2 minutes**:44 companion +32 services +32 discovery +67
  earlier web checks. Source: `.cache/companion-pass/final-tests.log` (ignored scratch).
- `npm run check`:125 PHP syntax checks,199 route audit,185 web/82 mobile/67 contract-test calls,
  62 role-permission pairs,0 problems; frontend and mobile typechecks passed.
- `npm run lint`, `git diff --check`, and production build passed;40 routes generated. Existing
  multiple-lockfile warning is unchanged. Server binds0.0.0.0; browser API URLs remain same-origin.
- All protected landing/root/global-style hashes match the start-of-batch baseline. Strict stable
  cold/client comparison after discovery, service and companion CSS:1440×5065, **0 differing channels**.
  Persisted evidence: [student-companion-landing-preservation.json](student-companion-landing-preservation.json).
- Deliverable: [student-companion-review.html](student-companion-review.html), self-contained gallery
  with clearly labelled fixture data and320/768/1440 captures. No production records are represented.

### Remaining limits

This is fixture-backed browser verification against audited controller contracts, not deployed Laravel
end-to-end testing. Real GPS/camera, concurrent real users, queue capacity transactions, WebSocket
reconnection/delivery, physical devices, cross-browser and screen-reader certification are not established.
Native mobile was not redesigned in this batch; its typecheck was preserved. Browser push is a backend
stub and is intentionally not advertised as enabled. Backend active-ticket selection excludes admitted
room tickets; the board's own ticket action can still open their full view. Historical assistant messages
do not expose saved actions in the current API, so reopening history cannot recreate those missing links.

**Progress:12/31** individually redesigned signed-in page implementations. Student map/dashboard final
audits and the remaining staff/admin screens are still pending. The expanded all-role pass is not complete.
