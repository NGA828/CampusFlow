# Operational alerts — individual web redesign

Date: 2026-09-16. Route: `/admin/alerts`. Gate recorded before implementation.
Scope adjustment: campus/services/academics were audited alongside alerts, but their storage-contract mismatches require a separate configuration pass. They are **not** counted as redesigned here. Landing sources and appearance are protected against the previously delivered working tree.

## Job and contract audit

The administrator needs to distinguish urgency, inspect a reported condition, investigate its configuration and optionally acknowledge exactly that fingerprint. This is a requested snapshot, not a live incident stream, resolution system, assignment system or history browser. Existing severity filters, optional notes, acknowledgement and Re-check must work. Server permissions remain authoritative.

Problems found: local key-based muting could override subsequent server snapshots; any resolved acknowledgement response was accepted; arbitrary server targets were rendered; link-wrapped buttons created nested controls; acknowledgement length was not constrained. Backend fingerprints often changed only with a day/hour bucket, not a changed reported condition. Closed-office ticket counts included unrelated open offices. Snapshot counts were computed from a separate second alert derivation.

## Research and comparison

Dribbble is primary. These are subjective **transfer estimates**, not tested accessibility, responsiveness or interaction claims about source products. Score order: visual/usability/hierarchy/interaction/responsiveness/mobile/accessibility/type/relevance. Weights: 15/20/15/10/10/10/5/5/10 percent.

| ID | Source and attribution | Inspected patterns / strengths | Weaknesses / rejected patterns | Scores → weighted total |
|---|---|---|---|---|
| L | [Loom — Incidents screen](https://dribbble.com/tags/incidents), designer and exact shot: **Not available**. Matching 400×300 search thumbnail; CDN userupload/21586203 original-e78f7e9f34ebd9629ef84cc5889464f2.jpg | Dedicated incident list beside an inspection surface; list and detail have distinct jobs | Dense dark navigation, small text, analytics/sparklines and invented insights; thumbnail limits inspection | 7/8/8/8/6/5/5/6/9 → 7.20 |
| I | [Incidents inbox](https://dribbble.com/tags/incidents), designer and exact shot: **Not available**. Matching 400×300 thumbnail; CDN userupload/21539648 original-e8f875f11639cfa40bfdf6a074b80dff876.jpg | Strong selected-row contrast and explicit incident timestamps | Cropped companion view of L, not an independent product; tiny timeline markers and color-only signals; no timeline data in our API | 7/7/8/7/5/5/5/6/8 → 6.70 |
| C | [Dashboard alerts and notifications](https://dribbble.com/search/alert-dashboard), designer and exact shot: **Not available**. Matching 400×300 thumbnail; CDN userupload/13919284 original-182c5eebc7835d2a10fec487a34b195c.jpg | Alerts in a contextual right rail, restrained surface separators | Claims/insurance graphs dominate; not a focused triage view; no charts or insurance metrics adopted | 8/7/7/6/6/5/5/7/6 → 6.55 |
| T | [Terchera — Online Appointment Schedule List](https://dribbble.com/shots/23673729-Terchera-Online-Appointment-Schedule-List), Fariz Al / 10am | Previously inspected exact reference; matching cached thumbnail re-opened. Readable chronological records with contextual actions and quiet filters | Appointment-specific content and tiny controls; no appointments/time ordering invented for severity-based alerts | Prior recorded weighted score **8.30**, detailed rubric in `staff-services-redesign.md` |
| N2 | [Notifications settings — Untitled UI](https://dribbble.com/shots/25796474-Notifications-settings-Untitled-UI), Jordan Hughes | Exact page fetched and its matching 752×564 artwork inspected. Explanatory sections, clear category labels, thin dividers and generous separation | Small checkboxes, dense account chrome; do not introduce unsupported notification settings or account menu | 8/8/9/8/7/6/6/8/9 → 7.85 |

Images L/I/C are saved under `.cache/alerts-pass/references`; N2 is copied there from image search. No reference artwork is shipped. Also fetched old Untitled UI shot 17219721, but its artwork was **not** newly inspected in this pass. A cached Stride search thumbnail was reopened; it depicts “My Task”, not a verified exact Stride shot, so it is **not selected or newly attributed**. Generic search results for Event Monitoring and education dashboards were discovery only, not selected artwork.

### Selection

Primary structural idea: **L**, because separating selection from review is the closest match to this page's actual task, despite a lower transfer score. Secondary: **N2** for explicit policy explanation and **T** for quiet filters and separated actions. C loses because metrics crowd out the work. I corroborates selection contrast but is not counted as a separate product.

Original adaptation: a warm, compact monitoring masthead; three honest snapshot metrics; severity-first condition ledger; an adjacent selected-condition review with explanation, safe configuration link, optional 300-character note and clearly scoped acknowledgement. No generic dashboard charts, avatars, resolution buttons or automatic-live claims. On narrow screens the review appears directly after its selected record, not below the entire list. Semantic buttons, visible text severity, robust wrapping, 44px targets and reduced-motion-safe transitions replace source micro-controls. No decorative hero image: urgency should not compete with illustration.

## Before implementation plan

1. Central strict alert projection and exact returned-fingerprint confirmation through the existing API client.
2. Backend condition-derived fingerprint; correlate closed-office counts; derive snapshot counts once. Preserve routes/platform gates. Existing old-format acknowledgements may require one re-review.
3. Scoped page/CSS only; no landing/shared global changes.
4. Raw-wire fixture tests for severity, selection, draft preservation, duplicate-click lock, unsafe target, malformed response, failures/retry, changed/repeated fingerprint, loading/empty and responsive keyboard behavior.
5. Static checks/build, prior regression suite, screenshots and strict landing comparison; report backend runtime limitations explicitly.

Implementation review and actual results will be appended only after verification.

## Implemented and reviewed

- Original severity-led ledger with adjacent review on desktop; the selected review is placed directly after its record **in the DOM as well as visually** at ≤900px. Resizing preserves note values. Only one note input and one review ID are mounted.
- API projection rejects missing lists, duplicate/oversized keys, unknown severity, malformed generation timestamps and missing acknowledgement totals. Severity counts come from the exact displayed snapshot. Missing/unread data displays `—`, not zero.
- Only known configuration paths become links. Native links replace nested link/buttons. Returned acknowledgement fingerprint must exactly match. There is no local mute list overriding a later server read. Notes are trimmed on submission, bounded to 300 characters and retained after failure; they are not persisted browser drafts.
- The operator write lock prevents duplicate requests and blocks filters/refresh during acknowledgement. A confirmed write followed by refresh failure shows both the recorded acknowledgement and the failed snapshot, never a healthy empty feed. Expired-session responses use the existing centralized sign-out/login behavior.
- Backend alert keys now append a 16-hex SHA-256 digest of reported severity/title/detail/target. Changed reported content re-emits under a different fingerprint; the same condition in the same bucket can still remain muted. **Old-format acknowledgement keys may require a one-time re-review.** This is not incident recurrence tracking, an audit-history UI or a resolution API.
- Closed-office tickets are correlated with the closed active office they belong to, not every office ticket on campus. Wording now describes remaining tickets, not an unverified claim of “unattended” people. Feed severity counts are computed from the returned derivation rather than a second snapshot.
- A compact shield line drawing supports monitoring identity; no stock hero image competes with urgent conditions. Motion is limited to selection/surface transitions and disabled for reduced-motion preferences. Narrow textareas use 16px text; the recorded-count caption avoids a broken long word.

### Per-page subjective quality review

Visual 9; usability 8; hierarchy 9; consistency 8; responsiveness 9; accessibility 8; interaction 8; performance 8; CampusFlow relevance 9; originality 8. Mean **8.4/10**. This is design judgment, not measured user research, performance certification or a WCAG conformance claim. Reviewed desktop/tablet/narrow populated, empty and error captures. Further real-device and assistive-technology testing remains appropriate.

## Verification — 2026-09-16

- **334 unique fixture-backed Playwright tests passed** (302 prior + 32 alerts), 6.4 minutes.
- After final caption, narrow input sizing and formatting polish: **58/58 repeated checks passed** (32 alerts + 21 layout + 5 discovery states), 1.9 minutes.
- Root check, PHP static parsing, API separation, frontend/mobile typechecks, lint and production build pass. Static inventory: 125 PHP files / zero parser errors; 199 routes, 185 web calls, 82 mobile calls, 101 test calls; 62 role-permission pairs; zero orphans/problems.
- Nine fixture screenshots: populated review, empty and failed snapshot at 320/768/1440px; no page overflow in checked states. `alerts-review.html` embeds these screenshots.
- Seven protected landing source hashes unchanged from the previous delivered tree. Strict 1440×5065 before/after comparison with matched default Chromium flags: zero differing channels. Separate cold-vs-client-return comparison through all three roles, including `/admin/alerts`: zero differing channels. Three identical captures per state, no masks or tolerance.
- Three new Laravel tests cover condition-changing fingerprints/idempotent acknowledgement, correlated office counts and validation/admin authority. **Not executed**: PHP and Composer remain unavailable; the previous installer attempt failed. Static parsing is not Laravel authorization/database/concurrency verification.

### Failures retained in evidence, not hidden

The first 30-case alert run passed. A subsequent extended run found a test locator matching both sidebar and review, and a test incorrectly expecting an inline 401 error instead of the existing login redirect. Both tests were corrected to match the intended contract. One initial strict landing client-return raster comparison differed by 97,484 channels; the unchanged strict standalone repeat, full 334-case run and final 58-case run all passed. No landing/style change, masking or tolerance was used to make that test pass. A diagnostic pre-edit-vs-current comparison using **different Chromium renderer flags** differed by 5,119,317 channels and was not treated as valid evidence; matching the original launch flags yielded zero, independently of the client-return test. Renderer sensitivity remains an explicit limitation of screenshot evidence.

## Completion scope

`/admin/alerts` is individually redesigned and fixture-verified. The canonical tracker is now **25/31**, not 28/31. Campus, services and academics remain pending after their audit; analytics, settings and spatial also remain. Login's final audit is separate. No all-role production-completion claim.
