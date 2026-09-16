# Responsive foundation — 2026-09-15

## Audit and scope

This is a shared-layout repair, not a replacement design for CampusFlow's role-specific screens.
Keep the existing ink/indigo wayfinding language and previously researched screen compositions.
Architecture inspected: Next.js 16 / Tailwind 4 web, Expo 57 / React Native 0.86 mobile,
Laravel 13 with Sanctum and PostgreSQL/PostGIS migrations. Existing API clients, role gates,
routes and schema remain authoritative and unchanged. No database/runtime integration is
claimed by this UI audit. Dependencies and both authentication providers were inspected.

Observed problems: intrinsic grid widths escape the shell; fixed secondary tracks activate
before there is enough space beside the desktop sidebar; notification popover coordinates
are relative to the bell rather than the viewport; dialog header/footer heights are not
included in the body height cap; phone form text is below 16px; native scroll content uses
`flex: 1`; stat/action rows do not adapt to available width or font scale; orientation is
locked; standalone native screens do not reserve the bottom safe area.

Implementation order: shared web constraints/controls/overlays → native Screen and adaptive
rows → screen-specific overflow fixes → regression tests → verification record.

## Research gate

Search: `responsive design material adaptive layout web.dev responsive images WCAG target size`.
Inspected the following primary-source documentation on 2026-09-15 (text/documentation review,
not a claim of inspecting rendered Dribbble screenshots). Existing screen visual research
remains in `../design-research.md`; no new major screen is introduced.

| Reference | Applicability / usability / accessibility / maintainability (1–10) | Mean | Decision |
| --- | --- | --- | --- |
| https://web.dev/articles/responsive-web-design-basics | 9 / 9 / 9 / 9 | 9.0 | Select content-first breakpoints, fluid sizing, local table overflow, capability-based queries. |
| https://reactnative.dev/docs/usewindowdimensions | 10 / 9 / 9 / 9 | 9.25 | Select live font-scale/window updates with measured container width; no cached device dimensions. |
| https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html | 9 / 10 / 10 / 9 | 9.5 | Select 44px web target baseline for primary controls; 48dp native buttons. This is an enhanced target, not a claim of full WCAG compliance. |
| https://docs.expo.dev/versions/v57.0.0/ | 10 / 8 / 8 / 9 | 8.75 | Verify installed SDK compatibility; keep existing native stack rather than adding another styling framework. |

Comparison: web breakpoints cannot solve native text scaling; native window dimensions cannot
fix nested CSS intrinsic sizing; W3C supplies measurable interaction constraints, not a visual
template. Combine their complementary guidance within CampusFlow's existing design system.

## Decisions before implementation

- Keep Tailwind 4 on web and StyleSheet/Flexbox on native. No Bootstrap, MUI or NativeWind migration.
- Use shrinkable `minmax(0, 1fr)` tracks and `min-width: 0`; do not mask bugs with body overflow hiding.
- Stack dense split panes until `xl`; retain full data in locally scrollable tables/timetables.
- Reserve safe areas and dynamic viewport height, permit text wrapping, and keep zoom enabled.
- Size native rows from their actual container plus current font scale, not named phone models.
- Verify public pages and representative role screens with browser tests using explicitly isolated
  API fixtures. Native policy tests are not a substitute for iOS/Android keyboard/device testing.

Implementation review and actual test results will be recorded in `../responsive.md` after testing.
