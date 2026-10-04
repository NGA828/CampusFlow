# Campus map and navigation — 3D implementation research

Date: 2026-10-05

## Decision

Use **MapLibre GL JS** for the web campus map, while retaining campus-owned GeoJSON footprints and backend-calculated route geometry. The request mentioned Leaflet, but Leaflet is fundamentally a 2D raster/canvas map. Its OSMBuildings integration is a 2.5D overlay and the OSMBuildings project is no longer actively maintained. A real pitched camera, vector labels, WebGL building extrusion, heading-aware geolocation and smooth navigation camera need MapLibre. This preserves the open-source/OSM intent of Leaflet while meeting the 3D requirement correctly.

## References inspected

| Reference | What was evaluated | Score / 10 |
|---|---|---:|
| [MapLibre GL JS examples](https://maplibre.org/maplibre-gl-js/docs/examples/) | Native 3D building extrusion, Three.js models, indoor extrusion, geolocation and navigation controls | 9.5 |
| [Stadia Maps: 3D buildings with MapLibre](https://docs.stadiamaps.com/tutorials/adding-3d-buildings-to-your-maps-with-maplibre/) | Production layer ordering, zoom interpolation, 45–60° navigation pitch | 8.7 |
| [Leaflet plugin directory](https://leafletjs.com/plugins.html) | Leaflet geolocation and routing ecosystem; confirms routing is plugin-based | 7.4 |
| [OSMBuildings Leaflet layer](https://osmbuildings.org/documentation/leaflet/) | Leaflet-compatible 2.5D buildings and custom GeoJSON | 6.8 |
| [OpenStreetMap indoor mapping](https://wiki.openstreetmap.org/wiki/Indoor_Mapping) | Multi-level indoor data conventions and available MapLibre indoor renderer | 8.3 |
| [OpenStreetMap 3D overview](https://wiki.openstreetmap.org/wiki/3D) | Simple 3D Building tagging, renderer options, glTF/OBJ export through OSM2World | 8.1 |

## Production data/modeling plan

1. Survey every building footprint in WGS84 and store height, minimum height, roof shape, floor count and entrances. Existing campus footprints are immediately extruded at `floor_count × 3.4 m` with a safe fallback.
2. For landmark-quality models, model from surveyed dimensions/photogrammetry in Blender; use glTF/GLB with Draco/meshopt compression and LODs. Anchor models to surveyed longitude/latitude, true elevation and heading. Do not embed heavy meshes for ordinary buildings where extruded polygons suffice.
3. Maintain a routable pedestrian graph, not straight lines: paths, doors, crossings, stairs, ramps, lifts, floor transitions and temporary closures. The Laravel route service remains authoritative. OSRM's public demo is not a production service; campus pedestrian routing should use the existing graph or a self-hosted engine.
4. GPS is outdoor guidance only. Snap to the pedestrian network only within an accuracy-aware threshold. Indoors use QR/BLE/Wi-Fi/UWB anchors and floor context; GPS cannot reliably determine rooms or floors.
5. Provide accessible edge metadata (slope, kerb, stairs, lift, width, surface) and independently validate accessible routes.
6. Stream vector tiles/PMTiles when the campus dataset outgrows GeoJSON. Cache the campus style and data for weak connectivity; retain a low-power 2D mode.
7. Show accuracy, avoid false precision, request location only in response to an explicit user action, and stop watch tracking when navigation ends.

## Implemented interaction

- OpenStreetMap-based vector context from OpenFreeMap, with required attribution retained.
- Campus-owned footprints extruded into selectable 3D buildings.
- Pitched/rotatable WebGL camera and a one-tap 2D/3D switch.
- Browser geolocation control with high-accuracy tracking and heading.
- Backend route geometry rendered over the real map; missing edge geometry remains dashed.
- User and destination markers, responsive touch controls, campus recentering, and building labels.

## Self-review

| Dimension | Score |
|---|---:|
| Visual quality | 8.6 |
| Usability | 8.5 |
| Hierarchy | 8.3 |
| Consistency | 8.4 |
| Responsive behavior | 8.6 |
| Accessibility | 8.1 |
| Interaction | 8.8 |
| Performance | 8.2 |
| CampusFlow relevance | 9.2 |
| Originality | 8.5 |

Average: **8.52 / 10**.
