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
Smaps contributed the selected-place card and floating-control pattern. Volpis was selected
as the implementation constraint because CampusFlow must render authoritative campus geometry
offline rather than depend on blocked third-party tile hosts.

### Selected primary reference

Apple Maps HIG principles, adapted rather than copied.

### Selected secondary references

Smaps for the compact place-information surface; Volpis for layered vector rendering and
floor-aware continuity.

## CampusFlow design decisions

- Keep the existing API-driven SVG map; do not invent roads or geographic data.
- Add a map header showing the published-building count and a selected-destination card
  with status, floor count, room count, and access information when those fields exist.
- Add functional controls for labels, reset, zoom, scale, and orientation context.
- Encode building state with colour plus text and legend labels, not colour alone.
- Render routes with a light underlay and animated signal line so the route remains legible
  over footprints.
- Keep the existing building-list search as the reliable narrow-screen navigation surface.
- Keep “Explore floors and rooms” as the explicit transition from the outdoor map to the
  authoritative indoor floor plan.

## Patterns rejected

- Third-party satellite/tile basemaps: unavailable in the target offline/local environment
  and not authoritative for the campus geometry.
- Decorative roads, paths, or landmarks not returned by Laravel: they would imply data that
  the backend does not provide.
- A map-only full-screen layout: it hides the building search and makes room discovery
  harder on small screens.

## Accessibility and responsive decisions

- Building groups remain keyboard-focusable and retain existing accessible labels.
- Controls have explicit labels and pressed state for the labels toggle.
- Status is represented by text in the legend and selected card as well as colour.
- The information card and map legend collapse naturally within the map frame; the existing
  building list remains above the map on narrow screens.
- Existing reduced-motion CSS still disables route animation and transitions.

## Review outcome

The previous map was structurally correct but visually under-signalled: it showed footprints
and zoom without orientation, destination context, status explanation, or a clear next action.
The refresh addresses those gaps while preserving the backend-authoritative geometry and route
contracts. Target review score: **8.6/10**.
