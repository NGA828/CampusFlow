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

Floors, corridors, stairs, the lift, the room numbers and the 39 rooms are a *working
model*. They are internally consistent, dimensioned and good enough to exercise
scanning, routing, step-free routing and room booking end to end — and they are not a
surveyed floor plan. No photograph showed an interior, and guessing a corridor length
is exactly the kind of invention that sends somebody down the wrong one. Every number
below is an **estimate**, derived as described here, and the API labels it as modelled.

### 3.1 How the estimates were derived

Each block is generated from one description — corridor length and bearing, then each
room's frontage, depth and side — by `apps/api/src/data/floorplan.ts`. Nothing indoors
is hand-placed, so the geometry cannot drift out of agreement with itself.

| Quantity | Value | Where it comes from |
| --- | --- | --- |
| Corridor width | **2.4 m** everywhere | Minimum comfortable double-loaded corridor; Cameroonian public-building practice. |
| ADM envelope | **26.2 m × 23.5 m**, long axis bearing −9.7° | Computed from the traced OSM outline of way 1244927072 — the one measured building. |
| ADM corridor | 22 m, starting 2 m inside the entrance wall | 26.2 m envelope minus the end walls and the stair core. |
| ADM room depth | 10.5 m | (23.5 − 2.4 corridor) ÷ 2, minus wall thickness. |
| PED corridor | 86 m over two floors | Length of the teaching block as fitted to the photographs (92 m) minus the end walls. |
| PED room depth | 6.8 m | Classroom depth for a 16 m-wide, 45-seat room — the proportion visible in the photographs. |
| CET corridor | 72 m, single storey | Length of the Centre d'Excellence footprint minus end walls. |
| CET room depth | 6.3 m | Laboratory depth consistent with the block's 16 m width. |
| Wall thickness | 0.6 m, drawn as the gap between the room polygons and the footprint | Masonry wall plus render. |

Floor areas follow from frontage × depth and are rounded to the square metre. The
total modelled area is about 3 100 m² over five floors.

### 3.2 The room-numbering scheme

Room numbers are `BLOCK + FLOOR + NN` — **`P104` is block P, floor 1, room 04**.

- **Block letter**: `P` Bloc Pédagogique, `A` Bloc Administratif, `C` Centre
  d'Excellence Technologique.
- **Floor digit**: `0` rez-de-chaussée, `1` premier étage. It is the middle digit, so
  a student reading a door knows which floor they are on without looking for a sign.
- **Serial**: **odd numbers on the left of the corridor, even on the right**, counted
  from the end of the corridor nearest the stairs — the convention used in Cameroonian
  public buildings. Numbers are not consecutive: gaps are left for rooms that exist
  but are not yet modelled.

A test (`every room number encodes its block, its floor and its side of the corridor`)
enforces all three rules, so a future room cannot be added in the wrong block, on the
wrong floor, or on a corridor side that does not exist.

### 3.3 The schedule of accommodation

#### PED — Rez-de-chaussée (couloir 86 m)

| N° | Salle | Côté | Largeur | Profondeur | Surface | Capacité |
| --- | --- | --- | --- | --- | --- | --- |
| P001 | Amphithéâtre A | gauche | 28 m | 6.8 m | 190 m² | 180 |
| P003 | Salle de TD 1 | gauche | 16 m | 6.8 m | 109 m² | 45 |
| P005 | Salle de TD 2 | gauche | 16 m | 6.8 m | 109 m² | 45 |
| P007 | Salle informatique 1 | gauche | 16 m | 6.8 m | 109 m² | 40 |
| P002 | Sanitaires | droite | 8 m | 6.8 m | 54 m² | — |
| P004 | Bureau des surveillants | droite | 8 m | 6.8 m | 54 m² | 6 |
| P006 | Salle de TD 3 | droite | 16 m | 6.8 m | 109 m² | 45 |
| P008 | Salle de TD 4 | droite | 16 m | 6.8 m | 109 m² | 45 |
| P010 | Foyer des étudiants | droite | 24 m | 6.8 m | 163 m² | 120 |

#### PED — 1er étage (couloir 86 m)

| N° | Salle | Côté | Largeur | Profondeur | Surface | Capacité |
| --- | --- | --- | --- | --- | --- | --- |
| P101 | Salle Réseaux | gauche | 18 m | 6.8 m | 122 m² | 30 |
| P103 | Salle de Projet | gauche | 14 m | 6.8 m | 95 m² | 25 |
| P105 | Salle de TD 5 | gauche | 16 m | 6.8 m | 109 m² | 45 |
| P107 | Laboratoire Matériel | gauche | 16 m | 6.8 m | 109 m² | 30 |
| P102 | Sanitaires | droite | 8 m | 6.8 m | 54 m² | — |
| P104 | Salle de TD 6 | droite | 16 m | 6.8 m | 109 m² | 45 |
| P106 | Salle de TD 7 | droite | 16 m | 6.8 m | 109 m² | 45 |
| P108 | Salle des enseignants | droite | 16 m | 6.8 m | 109 m² | 20 |

#### ADM — Rez-de-chaussée (couloir 22 m)

| N° | Salle | Côté | Largeur | Profondeur | Surface | Capacité |
| --- | --- | --- | --- | --- | --- | --- |
| A001 | Scolarité — guichet | gauche | 8 m | 10.5 m | 84 m² | 6 |
| A003 | Service des examens | gauche | 6 m | 10.5 m | 63 m² | 4 |
| A005 | Bureau des Stages | gauche | 6 m | 10.5 m | 63 m² | 4 |
| A002 | Accueil | droite | 6 m | 10.5 m | 63 m² | 10 |
| A004 | Salle d’Entretien 1 | droite | 6 m | 10.5 m | 63 m² | 8 |
| A006 | Sanitaires | droite | 4 m | 10.5 m | 42 m² | — |
| A008 | Économat | droite | 4 m | 10.5 m | 42 m² | 4 |

#### ADM — 1er étage (couloir 22 m)

| N° | Salle | Côté | Largeur | Profondeur | Surface | Capacité |
| --- | --- | --- | --- | --- | --- | --- |
| A101 | Salle du Conseil | gauche | 10 m | 10.5 m | 105 m² | 20 |
| A103 | Direction | gauche | 6 m | 10.5 m | 63 m² | 6 |
| A105 | Secrétariat de direction | gauche | 4 m | 10.5 m | 42 m² | 4 |
| A102 | Salle d’Entretien 2 | droite | 6 m | 10.5 m | 63 m² | 6 |
| A104 | Comptabilité | droite | 6 m | 10.5 m | 63 m² | 6 |
| A106 | Archives | droite | 4.5 m | 10.5 m | 47 m² | 2 |
| A108 | Sanitaires | droite | 4 m | 10.5 m | 42 m² | — |

#### CET — Rez-de-chaussée (couloir 72 m)

| N° | Salle | Côté | Largeur | Profondeur | Surface | Capacité |
| --- | --- | --- | --- | --- | --- | --- |
| C001 | Laboratoire Logiciel | gauche | 18 m | 6.3 m | 113 m² | 40 |
| C003 | Laboratoire Systèmes | gauche | 18 m | 6.3 m | 113 m² | 40 |
| C005 | Salle d’incubation | gauche | 14 m | 6.3 m | 88 m² | 25 |
| C007 | Salle serveur | gauche | 8 m | 6.3 m | 50 m² | — |
| C002 | Bibliothèque | droite | 28 m | 6.3 m | 176 m² | 80 |
| C004 | Salle de lecture | droite | 16 m | 6.3 m | 101 m² | 30 |
| C006 | Sanitaires | droite | 6 m | 6.3 m | 38 m² | — |
| C008 | Reprographie | droite | 8 m | 6.3 m | 50 m² | 4 |

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
- Nothing indoors is surveyed: the dimensions in section 3 are estimates derived from
  the one measured building and the photographs, not from a plan.
- The room numbers are a convention I imposed, not the numbers painted on the doors.
