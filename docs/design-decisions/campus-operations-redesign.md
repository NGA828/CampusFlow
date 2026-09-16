# Individual web pass — student planning/exploration and staff room queues

2026-09-16. Batch four. Protected landing/root/global CSS unchanged; prior dirty work retained.
Next CSS Modules guide and PROMPT research gate read before UI implementation.

## Pre-implementation research gate

Searches: Dribbble campus map/route dashboard, student schedule dashboard, queue/operator dashboard.
New matching images inspected for Studly and Route view dashboard. Unrelated CloudTalk/HR search
images are excluded. Reuse of prior inspected references is explicit, not claimed as new discovery.
Scores are subjective transfer estimates, not measured source-product usability/accessibility.
V/U/H/I/R/M/A/T/C; weights15/20/15/10/10/10/5/5/10 percent.

| Reference | Source / inspection / transferable idea and limitation | Scores | Weighted |
|---|---|---|---|
| D Studly — Marina Shevchenko / Netguru | https://dribbble.com/shots/17726302-Studly-Mobile-App-for-Students ; page + matching titled thumbnail inspected. Schedule-first student day, legible course sequence; reject invented homework, payment and progress charts. Thumbnail limits small-type assessment. | 8/9/9/8/8/9/7/8/10 | 8.60 |
| M Route view dashboard — designer Not available | https://dribbble.com/search/route ; search listing + matching titled thumbnail inspected. Dominant map beside place list; small map controls need accessible alternatives. Exact shot URL unavailable, not fabricated. No source map art, distances or routes copied. | 8/8/9/8/7/6/6/8/9 | 7.85 |
| Q QMS — FlutterMate | https://dribbble.com/shots/21221213-QMS-Queueing-Management-App ; reopened page; prior matching-thumbnail visual inspection reused. Ticket identity and facility/line separation. Student reference, not proof of operator UX. Reject fake timing guarantees. | 8/9/9/8/8/9/7/8/10 | 8.60 |
| S Stride — Adhitya Putra / Hatypo | https://dribbble.com/shots/25644823-Stride-Task-Management-Dashboard ; reopened page; previous matching visual inspection reused. State grouping and quieter context rail; don't copy progress/KPIs or drag/drop into a backend-controlled queue. | 9/9/9/8/8/7/7/9/8 | 8.40 |
| U UVER — Phenomenon Studio | https://dribbble.com/shots/19285593-UVER-Universities-Aggregator-Mobile-App ; prior documented page/studio-cover visual inspection reused. Discovery and mobile selection hierarchy; reject admissions workflow. | 9/9/9/8/9/9/7/9/9 | 8.80 |
| R Room Booking Dashboard — Adhitya Putra / Hatypo | https://dribbble.com/shots/20602523-Room-Booking-Dashboard-Admin ; prior documented image/page inspection reused. Room identity and list/actions; reject revenue analytics and tiny dense controls. | 9/8/8/8/7/7/6/9/8 | 7.95 |
| N Notification settings — Jordan Hughes | https://dribbble.com/shots/17219721-Notification-settings-page-Untitled-UI ; prior matching thumbnail/page inspection reused. Read-only policy context separated from operational changes, not notification preferences or unsupported settings. | 8/9/9/8/8/8/7/8/8 | 8.30 |

### Student dashboard — compare D / S / U / Q → D + S
A personal day planner, not three-role KPI cards: next class, chronological day agenda, a compact
service-ticket rail and campus notices/events. Existing original campus illustration remains decorative.
Keep actual published class times, missing room states, complete server quick links where web-safe,
independent queue-read failure and canonical office-ticket links. No fabricated academic performance.

### Student map — compare M / U / R / S → M + U
Map-first exploration with search/selected building, clearly separate indoor floor and room context,
and a deliberate route-preview mode. Preserve existing actual vector map, floor renderer and backend
route preview. Text alternatives to map selection. Saved position is not current physical presence;
failed position read isn't “no saved position”. Key building/floor subtrees to prevent stale floor/room
mixing after navigation. Absence of busy records cannot establish free room availability.

### Staff queue list — compare Q / R / S / N → R + S
An operational directory, not student ticket cards: scoped queues, anonymous line/occupancy counts,
search/state filter, clear console link, deliberate open/close and a quiet operational boundary rail.
Closed queues must remain listed so staff can reopen them. Policies remain admin-managed.

### Staff queue detail — compare Q / S / R / N → S + Q
A queue workbench with state-grouped tickets, one global Call next action, a selected-ticket action
panel and published policy context. Never put “Call next” on a named ticket (it calls another person).
Normalize lowercase statuses/raw names, serialize operations, confirm no-show/completion/presence,
validate returned ticket IDs/states and refresh authoritative counts after success. No optimistic
admission or invented live-delivery guarantee. Mobile becomes selected action + stacked state groups.

## Contract audit / planned work

- Actual bound StaffController list returns raw queues, only open rows, without StaffScope filtering;
  detail/mutations already call findQueue / findQueueTicket. Apply that existing backend scope to
  list including closed rows; no new permissions or client-side security filtering. Add backend
  regression test; PHP runtime/vendor are not currently installed, so do not claim it ran.
- Raw queue: id/is_open/capacity/current_count/max_capacity/avg_service_minutes; raw line:
  user_name/user_email, lowercase status. Normalize centrally, preserve caller-specific permissions.
- Dashboard uses TimetableEntry::toApiArray: course_name/type/wall-clock times, not guaranteed ISO
  timestamps/course_title/session_type. Prefer supplied today.date/remaining. Next class may be on
  another day; don't label it “today” or invent an ISO date.
- Map: failed/stale building/plan must not retain actionable rooms from a different floor. Preserve
  explicit from-anchor routing, step-free request and existing route validation. No live web navigation.

Plan: responsive/workflow fixtures, existing175 web regressions, build/lint/both-client typechecks,
PHP syntax/API audit, actual screenshot inspection and ten-dimension score>=8 before tracker changes.
Landing hashes plus strict stable cold/client pixel comparison including this batch's scoped CSS.

## Final implementation review

### Dashboard
Replaced the generic introductory spotlight with a daily planner: server-named next class, wall-clock
start/end, published weekday, chronological agenda, separate service tickets and campus bulletin.
Called tickets get a prominent review link even on narrow screens. Campus artwork is the existing
original decorative asset, never represented as a real map. Safe server quick links are preserved;
unknown/mobile/external URLs are not promoted to browser controls. Secondary queue failures remain
visible without discarding the schedule. Office receipts use the canonical ticket URL.

### Map
Building search + selection beside the actual vector map, separate indoor state, floor selector, room
position/selection and deliberate backend route preview. Changing building/floor remounts the dependent
subtree, preventing stale rooms. Zero-valued coordinates remain valid. A saved-position failure/loading
state never becomes “no saved position”; marker legends no longer say “you are here” without evidence.
Room/floor wire audit also found `type`, `plan_width_m` and `plan_height_m`. These are normalized at the
API boundary. Where the API omits room widths/heights, the renderer now draws labelled position points,
not NaN rectangles or invented walls. Removed an assumed corridor band: neither corridor geometry nor
walkability can be inferred from an empty graph. No local routing, scanner or live-navigation session.
Keyboard users can select every building/room through its accompanying text controls. Zoom targets44px.

### Staff queue directory
Anonymous scoped directory, query/state controls, counts and open/close actions with confirmation of
response ID/state. Closed lines stay in the list. Backend list uses existing StaffScope::canOperateQueue
before serializing rows; no new role grants or client-side authority. Nullable/unlimited max capacity
is preserved, not rejected or converted into a capacity promise. Narrow review caught compressed room
codes, badges and the state selector; controls now stack and identifiers/states remain unbroken.

### Staff ticket workbench
Waiting / arrival / inside lanes, one global server-ordered Call next, selected ticket workspace and
read-only policies. Deliberate desk check-in, admission, completion and no-show review steps; optional
no-show reason. UI guides the normal progression; the pre-existing admit/complete/no-show controller
methods permit broader transitions than this UI, so this is **not** a backend state-machine hardening
claim. All mutations still use existing scoped endpoints. Unknown responses never produce success.
Mutations serialize through a ref lock, invalidate older reads, and wait for authoritative refresh
before unlocking. A failed refresh removes the actionable stale line. Realtime events request refresh;
copy explicitly avoids a live-delivery guarantee. Narrow selection focuses the action workspace and
provides a return-to-line link, rather than changing a panel out of view.

## Verification

- Final combined run: **211/211 fixture-backed web checks, 4.7 minutes**. Existing175 + new36.
  `.cache/operations-pass/final-tests.log`. Coverage includes320/768/1440, raw Laravel names, later-day
  class, office links, independent failures, empty states, pending position read, zero coordinates,
  floor/building switching, raw room point geometry, capacity rejection, normal ticket sequence,
  reason submission, duplicate clicks, wrong success response, readable narrow identifiers/focus.
- Production Next build passed. Root lint, PHP parser/API-contract gates and web/mobile typechecks
  passed.125PHP source files parsed;199routes;185web/82mobile/70test call sites;62role-permission pairs;
  no reported contract problems. PHP parsing is not execution.
- Final source formatting applied only to this batch's new/rebuilt files; follow-up gates/build and
  current-batch checks verify the formatted source. No dependency manifest change for formatting.
- Protected seven source hashes unchanged. Strict cold/client navigation screenshot:1440×5065,
  **zero differing channels**, after discovery/services/companion/operations styles were loaded.
  Three matching captures per state, no masks/tolerance. `campus-operations-landing-preservation.json`.
- Visually reviewed desktop and narrow captures for each page plus indoor state. Main screenshots
  at320/768/1440; supplemental indoor captures at all three widths. Review gallery embeds main12
  and indoor desktop/narrow2. All use clearly labelled fixture data, not live campus records.

### Subjective ten-dimension review (not a user study)

Dimensions: visual / usability / hierarchy / consistency / responsive / accessibility / interaction /
performance / CampusFlow relevance / originality. Performance is an implementation estimate, not a
field benchmark. Scores do not certify WCAG or screen-reader behavior.

| Page | Scores | Mean |
|---|---|---|
| Student dashboard |9/9/9/8/8/8/8/8/9/8|8.4|
| Student map |8/9/9/8/8/8/8/8/9/8|8.3|
| Staff queue directory |8/9/9/8/9/8/8/8/9/8|8.4|
| Staff queue detail |9/9/9/8/8/8/9/8/9/8|8.5|

### Limitations / follow-up

Backend scope regression tests added to StaffTest (closed assigned queue + empty unassigned scope),
**not executed**: this environment has no PHP CLI, Composer/vendor or running Laravel backend. Browser
fixtures do not verify actual database transitions, multi-operator races, deployment RBAC, transport
reconnection, GPS, physical devices, cross-browser compatibility or assistive technology. The list
scope uses existing in-memory policy checks after loading queues; large-campus query optimization is
not claimed. Admission/no-show concurrency and broader backend transition enforcement remain separate
backend hardening work. Existing default unassigned-staff policy is unchanged; deployments must
configure their intended scope policy. No all-role redesign completion claim: this batch brings the
expanded individual signed-in-page review to **16/31**, with15staff/admin pages still pending.

Post-format follow-up: rebuilt production preview and reran the36new tests plus5discovery-state tests.
All **41/41 passed** in1.0minute. The first follow-up's cold landing capture timed out waiting for
three identical frames **before any workspace style load or pixel comparison**; the unchanged strict
rerun passed. No product edits, masks or tolerance were introduced for that retry. Baseline hashes
remained identical throughout. `.cache/operations-pass/formatted-tests{,-repeat}.log`.
