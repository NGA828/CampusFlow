# Campus administration — individual redesign

2026-09-16. Canonical page `/admin/campus`; three substantial workflows: buildings, floors, rooms. **Research gate recorded before UI implementation.** Landing is protected against the delivered alerts working tree. Services/academics remain separate pending pages.

## Audit and original direction

The old screen loaded capped first pages (server max100), filtered locally, used unsupported `campus_name`, `plan_width/height`, `room_type`, `plan_w/h` and silently converted blank coordinates to0. Floor creation also omitted the required database `code`. Parent movement controls were editable though update whitelists ignore parent IDs. A soft delete is not automatically protected by foreign keys. The redesign must address those contracts, not decorate misleading forms.

Direction: a **campus directory with progressive building → floor → room context**. All three directories remain searchable across the campus; selecting a building/floor narrows the next directory. Parent selection for creation comes from this paginated hierarchy rather than incomplete all-resource dropdowns. Building identity cards, floor-level ledgers and room inventory have distinct information layouts. Editors separate identity, geographic/plan metadata and policies; unsupported rectangle dimensions are removed in favor of supported room area and anchor coordinates. No fictitious floor-plan image or occupancy metric. Room capacity is metadata, not a queue limit.

## References inspected and scored

Scores are subjective transfer estimates, not measurements of source behavior. Order V/U/H/I/R/M/A/T/C: visual15%, usability20%, hierarchy15%, interaction10%, responsive10%, mobile10%, accessibility5%, typography5%, relevance10%.

| ID | Source, identity and inspection | Adopt / reject | Rubric → weighted |
|---|---|---|---|
| H | [Hotel Room Management SaaS](https://dribbble.com/tags/building_management). Matching 400×300 image shows HoPR room management. Designer/exact shot **Not available**. CDN4624227 original-0a02da9aff9267d3ccca5fa4dfa95713.png | Building sections → floor levels → room identities. Strong parent context. Reject tiny numbered tiles, hotel tasks, booking state and an unbounded single-page inventory. | 8/9/9/8/7/6/6/7/10 → 8.10 |
| P1 | [Property Management Dashboard](https://dribbble.com/search/property-management-dashboard). Matching 400×300 thumbnail, CDN15673581 original-d3c1f6fe2cc3d4e73947543123520b3d.png; designer/exact shot **Not available** | Clear property grouping, quiet surfaces. Reject sales/revenue widgets, financial charts and decorative totals. | 8/7/8/6/6/5/5/7/7 → 6.80 |
| P2 | [Property Management Dashboard](https://dribbble.com/tags/property-manager). Matching 400×300 thumbnail, CDN4269561 original-a7c441f3bab028f506ae4c49d69038df.png; designer/exact shot **Not available** | Restrained summary hierarchy and maintenance context. Reject finance-first architecture, charts, transactions and invented maintenance workflows. | 8/7/7/6/6/5/5/7/6 → 6.55 |
| R | [Room Booking Dashboard Admin](https://dribbble.com/shots/20602523-Room-Booking-Dashboard-Admin), Adhitya Putra / Hatypo Studio. Exact page fetched; matching 1568×1176 alternate artwork inspected, CDN4519620 original-a8b690ec1decc2823c7173250c5691da.png | Clear status-bearing records and hierarchy below the overview. Reject booking/revenue graphs and weak small text. | 8/8/8/7/6/5/5/7/8 → 7.20 |
| N2 | [Notifications settings — Untitled UI](https://dribbble.com/shots/25796474-Notifications-settings-Untitled-UI), Jordan Hughes. Exact page and matching artwork inspected in preceding alerts pass (same conversation; see alerts-redesign.md). | Explanatory configuration sections and deliberate inputs. Reject dense checkbox matrices and unsupported preferences. | Prior recorded 8/8/9/8/7/6/6/8/9 → 7.85 |

H/P1/P2/R images saved in `.cache/campus-admin-pass/references`. Search returned Bouking, Hotel Noorjahan and Room Operation shots; their artwork was not inspected, so they are not selected. No external artwork is shipped in the product.

## Per-workflow comparison and selection

- **Buildings:** H8.10 vs P1 6.80 vs R7.20 vs N2 7.85. Select H’s identity-first hierarchy + N2’s explanatory editor. P1’s property cards inform spatial grouping but finance dominates its hierarchy. Original code plaque, actual floor count, geographic metadata and status—not a hotel/property sales dashboard.
- **Floors:** H8.10 vs R7.20 vs N2 7.85. Select H’s level context + N2’s distinct geometry section. Replace tiny floor tabs with readable floor-level ledgers; expose real `code`, signed level and metre dimensions. Parent building is immutable on edit.
- **Rooms:** H8.10 vs P2 6.55 vs R7.20 vs N2 7.85. Select H’s room identities + R’s explicit status + N2’s policy explanation. Cards distinguish physical capacity, type, admission requirement and saved anchors, without claiming availability or drawing fabricated rectangles. Parent floor is immutable on edit.

Original schematic line illustration communicates the building/floor/room hierarchy, explicitly not a map. Scoped CSS handles meaningful hover/selection transitions and reduced motion. The small-form mobile design uses touch-sized controls and focus-trapped dialogs. Existing centralized API transport and permissions remain authoritative.

## Verification plan

Backend-first validation, exact raw-field projections, real server pagination/search/context filters, identity/field confirmation before success, retained drafts and write locks, deliberate unused-record removal. Raw-wire fixtures exercise all three workflows, failures, parent selection beyond page1, malformed responses, scoped search, zero/null geometry and narrow dialogs. Verify browser layouts, build/lint/static checks and seven protected hashes plus strict landing isolation before advancing the tracker. PHP/Composer installer and Debian prerequisite downloads are unavailable in this sandbox; backend tests may remain unrun and must be reported honestly.

## Implemented review — acceptance held (2026-09-16)

All three workflows are now implemented with a scoped CSS module and strict centralized adapter.
Buildings use identity cards and real floor counts; floors use signed-level ledgers with metre
geometry; rooms distinguish type, physical capacity, stored anchors and policy. Context selectors
and search are server-paginated rather than truncated dropdowns. Blank nullable numbers remain
null,0 remains0, and dirty patches retain unexposed spatial/policy fields. Fresh identity/field/parent
confirmation gates success. Creates, conflicting removals, failed reads and failed writes have
explicit states; drafts survive403/409/422/429/503 and contradictory success envelopes.

**Visual review:** inspected the21 captures across320/768/1440: all directories, floor/room dialogs,
empty and error states. Narrow chrome is locally compact; the hierarchy becomes three touch-sized
steps; dialogs scroll internally with visible actions. The full-page screenshots show fixed
navigation at the initial viewport edge, not an extra in-document navigation row. Hero illustration
is an original hierarchy diagram, not a fictitious campus plan. See [review gallery](campus-admin-review.html).

**Verification:**41 campus tests passed;46 campus/discovery-state checks passed together. A full
375-case selection returned374 passed and1 failed (landing strict comparison:31,759 channels).
An isolated rerun passed with0 channels, but another isolated run reproduced the mismatch. A
matched viewport-repaint experiment passed alone then a second full375 run had374 passes and a
landing settling timeout. A paused-clock experiment failed all3 repetitions. Both ineffective
experiments were removed; no masking, pixel tolerance or relaxed equality was introduced.
Final test setup retains three exactly identical captures and exact zero-channel comparison.

Production build, frontend lint, both-client types, PHP syntax parsing (127 files) and API static
checks pass:199 routes,185 web calls,82 mobile calls,123 test calls,62 permission pairs,0 orphans.
Five authored Laravel feature tests are unrun; no real database/auth/concurrency certification.

**Landing acceptance blocker:** all seven protected source hashes match the pre-edit working tree.
However the direct pre-edit/post-edit1440×5065 comparison differs by31,759 channels. Differences
cluster around existing hero/backdrop chips with a tiny lower-page region. DOM inline styles also
matched in one failing isolated comparison; this does not prove all computed styles or the root
cause. Renderer/compositor behavior is a hypothesis, not a finding. Preserve the failed and passing
evidence; do not declare landing appearance unchanged or the full regression suite green.

**Tracker remains25/31 accepted.** Campus is implemented and fixture/visual-reviewed, but final
acceptance is held on landing preservation. Services, academics, analytics, settings and spatial
remain unimplemented in the individual pass. Next work should diagnose the preservation failure
without editing the protected landing or weakening assertions, then accept campus and continue services.
