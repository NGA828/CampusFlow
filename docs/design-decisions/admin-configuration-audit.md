# Pending administrator configuration pass — audit notes

2026-09-16. **Not a completion record or a UI research gate.** `/admin/services` and `/admin/academics` remain pending. Campus implementation is now complete but acceptance is held on landing raster preservation; see campus-admin-redesign.md. Their initial joint pass was separated from the delivered alert redesign after storage/API mismatches were discovered. Preserve existing functionality, but do not preserve false-success behavior. Finish backend/model/migration and page reads in small sections; some initial combined tool output was truncated.

## Campus — original findings (now addressed; acceptance held)

- Old page eagerly requests buildings100/floors300/rooms400. Check actual server pagination caps; loaded lengths/filtering do not represent the whole campus. Independently complete selectors and real pagination are needed.
- Building `campus_name` is not writable; blank coordinates must not become `Number('') === 0`. Create/update validation is sparse. Do not promise database-protected deletion without schema evidence.
- Floors accept `plan_width_m/plan_height_m`, not `plan_width/plan_height`; building parent is create-only.
- Rooms accept `type`, `area_m2`, `plan_x/y`, lat/lng and `floor_id` on create. The form currently uses `room_type`, `plan_w/h`, building/floor movement fields which are not accepted. Do not imply rectangle geometry or a changed floor was saved. Preserve supported status, capacity, features, admission and visibility/access policies.
- Building search is name-only. Room/course ungrouped OR queries need grouped filters; audit before changing server behavior.

## Services

- Queue whitelist currently ignores several existing form policies. Supported model fields and actual controller consumption were inspected: `join_requires_proximity`, `allow_multiple_active_tickets`, `avg_service_minutes`, `no_show_grace_minutes` exist and are used by queue logic. Finish current form audit before aligning validation/whitelists. Capacity-sensitive changes require backend locks/validation, not frontend-only constraints.
- `rooms_without_queue` includes rooms without admission requirements. Do not label these “admission-only” or call the campus “all configured” from an incomplete subset.
- Office aliases exist for service duration/contact/active fields. `daily_capacity: null` is valid and must not silently become80 on edit. Preserve status rather than flattening maintenance/closed into active. Configured active is not effectively open now.
- Service windows use `label`, day0–6, H:i times, capacity and both `status`/`is_active`; parent office is create-only. Creation validates closes-after-opens, update currently lacks comparable validation. Model aliases exist; do not assume every frontend field is stored.

## Academics

- Term table/model store `starts_at/ends_at`; controller currently orders/writes `start_date/end_date`; old UI sends `starts_on/ends_on`. Align migration-backed fields, immutable code and meaningful validation. Audit current-term switching semantics instead of promising exclusivity without backend implementation.
- Courses store `name`, not `title`; UI currently sends title/colour/level fields outside the current whitelist. Finish model/migration review and distinguish actual metadata from unsupported decoration.
- Enrollment returns `{enrollment: ...}` from firstOrCreate; an existing enrollment can have a different status. Check identity/status rather than assuming the requested mutation occurred. Server student-role validation needs audit; raw student/course relations require projection.
- Timetable read takes `term_code`, not UI `term`, and server uses current term when the parameter is omitted. Explicit blank may mean all; validate controller semantics. Day filtering is not currently applied by that endpoint; client filters must be honest. Actual timetable fields are `starts_at/ends_at`, `course_name`, `lecturer_id`, etc.

Next: finish audits, research/compare ≥3 references **per page** (and page-specific major workflows), document gate before UI, implement centralized strict adapters, add raw-wire tests and backend tests, verify responsive layouts and preserve seven landing hashes/pixels. No changes to these three product pages were made in the alerts delivery.
