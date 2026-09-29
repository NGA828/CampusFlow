# Campus wayfinding correction — 2026-09-29

## Audit and decision (before implementation)
The web uses Next/React SVG maps and a Laravel/PostgreSQL navigation graph. Auth and route selection remain server-authoritative; live positioning is mobile-only. Existing Dijkstra minimizes edge weight (the API defines weight as metres), but adjacency includes inactive nodes. Leg grouping joins coordinate systems across floors. The indoor preview always places the walker at the first node. Outdoor rendering has an unsafe straight-line fallback. Empty routes are returned as success. PHP/Composer are absent; php.new installation failed with TLS/network error. Backend runtime verification is therefore blocked unless prerequisites become available.

## Inspected references
Scores are engineering suitability judgments, not endorsements or tested product scores.

| Reference | Score /10 | Selection |
| --- | --- | --- |
| https://dribbble.com/tags/wayfinding_map (Manitoba / Trinity campus-map references) | 7 | Campus orientation and identifiable buildings; illustration alone does not provide routing. |
| https://steerpath.com/smart-campus | 9 | Select coordinated indoor/outdoor wayfinding and floor context. Page text inspected; live product not tested. |
| https://maplibre.org/maplibre-gl-js/docs/examples/animate-a-point-along-a-route/ | 9 | Select route-linked marker, rather than unrelated timer/text. Never copy its straight-line demo as a campus route. |
| https://leafletjs.com/examples/quick-start/ | 8 | Useful basemap/polyline separation and attribution requirements; adding a second renderer is unnecessary for this correction. |
| https://www.openstreetmap.org/about | 8 | Optional future outdoor context, not a substitute for surveyed indoor corridors. |

## Scope
Fix deterministic route integrity first. Show a visible route with direction arrows, selected-step position, floor switching, start/destination labels, distance and backend time. Preserve the existing vector campus/floor maps and offline-friendly data approach. Do not draw a shortcut across missing geometry or floors. Provide a distinct no-route state. Make route steps keyboard operable, keep controls legible on narrow screens, and label playback as a preview rather than GPS.

## Production requirements
Campus staff must survey/publish connected footpaths, bends, entrances, stairs, lifts, room-entry nodes, accurate metre weights and accessible flags; deactivate blocked nodes. Shortest means shortest in that published network, not a claim about unmapped shortcuts. Future basemap integration requires a licensed tile provider, attribution and network-failure handling. A basemap does not repair fictional or incomplete seed geography.

## Verification
- `npm run check`: PHP syntax, API/platform separation, web and mobile TypeScript pass.
- 40 Playwright tests pass (new route geometry/preview tests and existing campus operations regressions). UI tests use intercepted API fixtures, not a live Laravel database. Checked 390px and 1280px route layouts and existing explorer widths 320/768/1440px.
- Browser installation initially failed; obtained an isolated Chromium package via npm and ran with its bundled shared libraries. No browser binaries or test screenshots added to Git.
- Touched-file ESLint passes. Repository-wide lint has an existing `react-hooks/set-state-in-effect` failure in `components/ui/qr-code.tsx`.
- Added Laravel regressions for weighted shortest path, inactive-node exclusion, step-free detour, disconnected destinations, and one-way edges. These are syntax-checked but NOT runtime-tested: PHP/Composer/PostgreSQL integration is unavailable here.

## UI review
Screenshot-reviewed route layout (fixture geometry): hierarchy 9, usability 8, consistency 8, narrow layout 8, keyboard semantics 8, route interaction 8, rendering simplicity 9, campus relevance 9, originality 8, visual quality 8; mean 8.3/10. This is a self-review of the correction, not a claim of independently audited accessibility or surveyed campus accuracy. Floor metadata moved out of the drawing area after review because it covered the first waypoint. Live-position tracking and external basemap integration remain out of scope.
