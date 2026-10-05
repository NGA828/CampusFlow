# CampusFlow design decision record

## Screen

Student campus map (`/student/campus/map`) and the shared outdoor route preview.

## User role

Student, with the map component also reused by route previews.

## Research sources

1. Apple, **Maps — Human Interface Guidelines**  
   https://developer.apple.com/design/human-interface-guidelines/maps  
   Inspected for map hierarchy, location context, controls, and the need to keep the
   destination/current-position relationship visible.
2. Behance, **Smaps — Social Maps, GPS locations and Messaging App**  
   https://www.behance.net/gallery/215973689/Smaps-Social-Maps-locations-and-Messaging-App  
   Inspected for a compact map-first composition, floating controls, and a clear
   selected-place information surface.
3. Volpis, **How to develop an indoor navigation app**  
   https://www.volpis.com/blog/how-to-develop-an-indoor-navigation-app  
   Inspected for the floor-plan/SVG approach, layered map elements, POI attributes,
   and multi-floor transition context without depending on tile servers.

## Reference scores

Scores use the project rubric: clarity 25%, wayfinding 20%, density 20%, accessibility
15%, responsiveness 10%, and CampusFlow consistency 10%.

| Reference | Clarity | Wayfinding | Density | Accessibility | Responsive | Consistency | Weighted |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Apple Maps HIG | 9 | 9 | 8 | 9 | 8 | 7 | 8.5 |
| Smaps | 8 | 8 | 8 | 7 | 8 | 7 | 7.8 |
| Volpis indoor navigation | 9 | 9 | 7 | 8 | 8 | 8 | 8.3 |

## Comparison and selection

Apple's hierarchy was strongest for keeping orientation and map controls understandable.
Smaps contributed the selected-place card and floating-control pattern. Volpis remains the reference for floor-aware indoor plan overlays, not the outdoor renderer.
The outdoor map uses MapLibre because the selected direction requires real 3D extrusions and
native mobile support; a strict Leaflet implementation would need a custom WebGL overlay and a
mobile WebView bridge.

### Selected primary reference

Apple Maps HIG principles, adapted rather than copied.

### Selected secondary references

Smaps for the compact place-information surface; Volpis for layered vector rendering and
floor-aware continuity.

## CampusFlow design decisions

- Use MapLibre GL JS for the web map and MapLibre Native for the native mobile map.
- Use the OpenFreeMap Liberty style for the OpenMapTiles/OSM context layer; its inspected
  `building-3d` layer uses mapped building heights.
- Overlay CampusFlow geometry only when the backend has verified coordinates and footprint data.
  Verified footprints remain visible as filled 2D shapes until an explicit measured `height_m`
  is available for a CampusFlow-owned 3D extrusion; do not generate square footprints or guess
  height from floor count.
- Keep Laravel's navigation graph and route geometry authoritative. Saved edge geometry is solid;
  edges without it remain visibly dashed and must not be mistaken for a surveyed path.
- Center on a valid saved user fix when it becomes available; request a fresh device location
  only after an explicit action on web/mobile. Use validated QR anchors for indoor
  building/floor positioning; GPS alone does not identify a floor.
- If the external style cannot load, web and native mobile use a local neutral MapLibre style
  and retain saved campus features/routes with a visible degraded-mode notice rather than an
  endless loader.
- Keep the existing building-list search as the reliable narrow-screen navigation surface.
- Keep “Explore floors and rooms” as the explicit transition from the outdoor map to the
  authoritative indoor floor plan.

## Patterns rejected

- Leaflet-only rendering for this requirement: it has no first-party extrusion layer and does
  not provide the native React Native renderer needed by the mobile app.
- Decorative roads, paths, or campus building shapes not returned by a mapped data source or
  Laravel: they imply data that the backend does not provide.
- Unverified tile-service availability: MapLibre remains usable in a reduced local-data mode,
  but street tiles require a reachable provider and production SLA/usage terms.
- A map-only full-screen layout: it hides the building search and makes room discovery
  harder on small screens.

## Accessibility and responsive decisions

- Building groups remain keyboard-focusable and retain existing accessible labels.
- Controls have explicit labels and pressed state for the labels toggle.
- Status is represented by text in the legend and selected card as well as colour.
- The information card and map legend collapse naturally within the map frame; the existing
  building list remains above the map on narrow screens.
- OpenStreetMap attribution remains visible in the map controls; no bulk tile download is used.
- Existing reduced-motion CSS still disables route animation and transitions.

## Review outcome

The previous SVG map was structurally correct but lacked real-world context and true 3D. The
MapLibre renderer provides both where the base map has mapped data, while verified CampusFlow
geometry and the route graph remain authoritative. Missing geometry is surfaced, not synthesized.

### Implemented-screen quality score (2026-10-05)

Scored against the desktop map and its tested offline geometry fallback, including the 320px
responsive layout. Each category is equally weighted as required by the screen quality gate.

| Category | Score | Evidence |
| --- | ---: | --- |
| Visual quality | 8/10 | Clear map frame, visible saved building pins/footprints and a distinct offline state; true extrusions require measured height data. |
| Usability | 8.5/10 | Building list, map selection, recenter, 2D/3D, location and retry actions. |
| Information hierarchy | 8.5/10 | Campus/route choice, saved-position state, selected building and map controls are distinct. |
| Consistency | 8/10 | Uses the existing CampusFlow controls, status colors and card language. |
| Responsiveness | 8.5/10 | Browser regression checks cover 320px, 768px and 1440px layouts. |
| Accessibility | 8/10 | Named map controls, keyboard-operable building markers, textual failure state and OSM attribution. |
| Interaction quality | 8.5/10 | Map pan/zoom/pitch, marker selection, explicit location and graceful fallback are wired. |
| Performance | 8/10 | Campus data is bounded; stalled style/API loads do not leave a permanent loading state. |
| CampusFlow relevance | 9/10 | Published buildings, saved user fixes and Laravel routes are the displayed sources. |
| Originality | 8.5/10 | Product-specific campus/route controls and data-driven geometry, without copying a reference layout. |
| **Average** | **8.35/10** | **Passes the 8/10 screen gate.** |

The score covers the available test and sample data. Production campus identity, building
extrusions and route accuracy still depend on surveyed building footprints/heights and verified
navigation graph geometry being entered for the actual institution.
