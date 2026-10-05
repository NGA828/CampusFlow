# IAI Cameroun — campus survey notes

How the pilot campus model in `apps/api/src/data/campus.ts` was built, and exactly how
far each part of it can be trusted. CampusFlow shows real places to people who will
walk to them, so the difference between *measured*, *mapped* and *modelled* is written
down rather than smoothed over.

## 1. Measured: the perimeter

| Fact | Value | Source |
| --- | --- | --- |
| Campus polygon | 14 vertices, transcribed verbatim | [OSM way 455178620](https://www.openstreetmap.org/way/455178620) |
| Tags | `amenity=college`, `name=Institut Africain d'Informatique`, `official_name=Centre d'Excellence Technologique Paul Biya`, `short_name=IAI` | same |
| Area | 4.6 ha (shoelace on the ring) | computed |
| Extent | ≈ 280 m east–west, ≈ 258 m north–south | computed |
| Centroid | `11.558265, 3.813771` | computed — the origin of the local metre grid |

The 4.6 ha measured from the polygon agrees with the campus being described publicly as
a five-hectare site, which is the main reason to trust the polygon.

One building outline is also surveyed: [OSM way 1244927072](https://www.openstreetmap.org/way/1244927072)
("IAI new building"), a 26 × 24 m block on the north-west edge sharing a node with the
perimeter. It is used verbatim as the **Bloc Administratif** footprint.

A test enforces this: `every mapped feature lies inside the surveyed campus perimeter`
checks all 44 graph nodes, all landmarks and every footprint corner against the ring.

## 2. Observed: what the photographs show

Photographs supplied by the user (Google Maps contributor shots of the campus,
October 2026). Each line is a feature I could identify and place; nothing here carries
a measured coordinate.

| Photograph | What it establishes | Modelled as |
| --- | --- | --- |
| Brick-pillared gate with an arched `IAI` sign, laterite street, blue kiosk outside | The main entrance and its approach road on the west side | `lm-gate`, node `n-out-gate`, QR anchor `IAI-PORTAIL` |
| Long green R+1 block with a wing at each end, seen across a garden | The teaching block is U-shaped, two storeys, facing its garden | `iai-b-ped` footprint (U opening west), two floors |
| Paved alley on the building axis, clipped hedges, conifers | The central alley and garden between gate and teaching block | `lm-garden`, nodes `n-out-alley1` → `n-out-garden` |
| Row of ~10 flagpoles (IAI member states) beside a "Welcome to IAI-Cameroon" board | The flag plaza, the most recognisable waypoint on campus | `lm-flags` |
| Rock fountain with a statue of a graduate pouring water | The fountain next to the welcome board | `lm-fountain` |
| Two students seated back to back on a paved terrace of log benches, valley behind | The statue terrace, and that the campus sits on a crest | `lm-statues`, `lm-viewpoint` |
| Long low block with a continuous verandah across a tarmac forecourt; `IAI` painted in white on the tarmac | The Centre d'Excellence and its esplanade/parking | `iai-b-cet`, `lm-esplanade`, `lm-parking`, anchor `IAI-ESPLANADE` |
| Second green two-storey block standing in lawn, reached by stepping stones | There is at least one more block not yet modelled | **not modelled** — see below |

## 3. Modelled: everything indoors

Floors, corridors, stairs, the lift, room numbering and the 14 rooms are a *working
model*. They are internally consistent and good enough to exercise scanning, routing,
step-free routing and room booking end to end — and they are not a floor plan. No
photograph showed an interior, and guessing a corridor length is exactly the kind of
invention that sends somebody down the wrong one.

To replace this with the real thing I need, per building: a floor plan (a phone photo
of the plan on the wall is enough), the floor names in order, one known length for
scale, the room list with codes, and where the stairs and lifts are.

## 4. Known gaps

- The second green block visible in the photographs is not in the model; I do not know
  what it houses.
- Building **heights and entrances** are estimated; the teaching block certainly has
  more than one door.
- The footprints of PED and CET are rectangles fitted to the photographs, not traced
  outlines. The ADM footprint is the only traced one.
- Nothing indoors is surveyed. See section 3.
