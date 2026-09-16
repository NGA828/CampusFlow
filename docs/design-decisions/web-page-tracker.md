# Web page-by-page redesign tracker

Scope: all 31 distinct signed-in page implementations, plus login. Three role-root redirects and
two student aliases are not extra screens. Landing is excluded and protected. This tracker does not
count shared CSS as an individual redesign. Prior work is preserved, but its final individual audit
is still separate.

**Completed in this expanded pass:** all student pages, shared account/notifications, all eight staff pages and three admin pages (**25 of 31** signed-in implementations).
**Next:** resolve campus landing-preservation acceptance (UI/contracts implemented;41 campus fixture tests pass), then services and academics (contract repairs pending), followed by analytics, settings and spatial — six admin pages remain unaccepted. The full all-role pass is still in progress.

| Page | Status | Evidence / next action |
|---|---|---|
| `/login` | Prior bespoke redesign; final audit pending | web-visual-redesign.md |
| `/account` | Individually redesigned & fixture-verified | student-companion-redesign.md; student-companion-review.html |
| `/admin/academics` | Individual pass pending | Preserve existing functionality; research and individually redesign/review |
| `/admin/alerts` | Individually redesigned & fixture-verified | alerts-redesign.md; alerts-review.html |
| `/admin/analytics` | Individual pass pending | Preserve existing functionality; research and individually redesign/review |
| `/admin/campus` | Implemented & fixture/visual-reviewed; acceptance held | campus-admin-redesign.md; campus-admin-review.html; strict landing preservation unresolved |
| `/admin/dashboard` | Individually redesigned & fixture-verified | coordination-redesign.md; coordination-review.html |
| `/admin/services` | Individual pass pending | Preserve existing functionality; research and individually redesign/review |
| `/admin/settings` | Individual pass pending | Preserve existing functionality; research and individually redesign/review |
| `/admin/spatial` | Individual pass pending | Preserve existing functionality; research and individually redesign/review |
| `/admin/users` | Individually redesigned & fixture-verified | coordination-redesign.md; coordination-review.html |
| `/notifications` | Individually redesigned & fixture-verified | student-companion-redesign.md; student-companion-review.html |
| `/staff/content` | Individually redesigned & fixture-verified | coordination-redesign.md; coordination-review.html |
| `/staff/dashboard` | Individually redesigned & fixture-verified | coordination-redesign.md; coordination-review.html |
| `/staff/offices/[id]` | Individually redesigned & fixture-verified | staff-services-redesign.md; staff-services-review.html |
| `/staff/offices` | Individually redesigned & fixture-verified | staff-services-redesign.md; staff-services-review.html |
| `/staff/queues/[id]` | Individually redesigned & fixture-verified | campus-operations-redesign.md; campus-operations-review.html |
| `/staff/queues` | Individually redesigned & fixture-verified | campus-operations-redesign.md; campus-operations-review.html |
| `/staff/rooms` | Individually redesigned & fixture-verified | staff-services-redesign.md; staff-services-review.html |
| `/staff/timetable` | Individually redesigned & fixture-verified | staff-services-redesign.md; staff-services-review.html |
| `/student/announcements` | Individually redesigned & fixture-verified | student-discovery-redesign.md; student-discovery-review.html |
| `/student/assistant` | Individually redesigned & fixture-verified | student-companion-redesign.md; student-companion-review.html |
| `/student/campus/events` | Individually redesigned & fixture-verified | student-discovery-redesign.md; student-discovery-review.html |
| `/student/campus/map` | Individually redesigned & fixture-verified | campus-operations-redesign.md; campus-operations-review.html |
| `/student/campus/rooms/[code]` | Individually redesigned & fixture-verified | student-discovery-redesign.md; student-discovery-review.html |
| `/student/campus/rooms` | Individually redesigned & fixture-verified | student-discovery-redesign.md; student-discovery-review.html |
| `/student/dashboard` | Individually redesigned & fixture-verified | campus-operations-redesign.md; campus-operations-review.html |
| `/student/services/offices/[code]` | Individually redesigned & fixture-verified | student-services-redesign.md; student-services-review.html |
| `/student/services/offices` | Individually redesigned & fixture-verified | student-services-redesign.md; student-services-review.html |
| `/student/services/offices/tickets/[id]` | Individually redesigned & fixture-verified | student-services-redesign.md; student-services-review.html |
| `/student/services/queues` | Individually redesigned & fixture-verified | student-companion-redesign.md; student-companion-review.html |
| `/student/timetable` | Individually redesigned & fixture-verified | student-services-redesign.md; student-services-review.html |

Shared `/account` and `/notifications` now remain outside the student-only layout for all resident roles.

Aliases: `/student/profile` → account implementation; `/student/notifications` → notifications implementation. Role roots redirect to dashboards. Authentication registration/recovery/reset and service-status pages are ancillary surfaces to audit after the signed-in role pass; they are not silently counted as complete.
