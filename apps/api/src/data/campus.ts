import type { Building, CampusBoundary, Landmark, NavEdge, NavNode, QrAnchor, Room } from '../types.ts';

/**
 * The IAI Cameroun pilot campus — Centre d'Excellence Technologique Paul Biya,
 * Nkol Anga'a, Yaoundé.
 *
 * Two different kinds of truth live in this file and they are kept apart on purpose:
 *
 *  • The **perimeter** is surveyed data — OpenStreetMap way 455178620, tagged
 *    `amenity=college`, 4.6 ha. Its fourteen vertices are transcribed verbatim below.
 *    The mapped outline of the north-west block (OSM way 1244927072, "IAI new
 *    building") is likewise real.
 *  • The **internal layout** — where the alley runs, which block is which, where the
 *    flagpoles and the fountain stand — is a model built from photographs of the
 *    campus: the arched IAI gate, the long green R+1 teaching block around its
 *    garden, the flag plaza and graduate fountain by the "Welcome to IAI-Cameroon"
 *    sign, the two seated student statues on their paved terrace above the valley,
 *    and the esplanade with IAI painted across the tarmac. Those features are real
 *    and recognisable; their coordinates are estimated to a few metres.
 *
 * Every room, corridor and floor is a working model, detailed enough to exercise
 * scanning, routing and booking end to end. It is not a measured floor plan, and no
 * screen pretends otherwise. `docs/iai-campus-survey.md` records which photograph
 * supports which feature.
 */

/** OSM way 455178620, the campus perimeter, as [longitude, latitude]. */
const BOUNDARY_RING: [number, number][] = [
  [11.5576869, 3.815002],
  [11.5575595, 3.8147465],
  [11.5574259, 3.8144306],
  [11.5573141, 3.8140747],
  [11.5573476, 3.8139061],
  [11.5572564, 3.8134806],
  [11.5573677, 3.8130858],
  [11.5581087, 3.8129361],
  [11.558454, 3.8128664],
  [11.5590817, 3.8126683],
  [11.5594357, 3.8132304],
  [11.5597898, 3.8138405],
  [11.559779, 3.8142794],
  [11.5591031, 3.814242],
  [11.5576869, 3.815002],
];

/** The perimeter's centroid — the origin of the local metre grid used below. */
const ORIGIN: [number, number] = [11.558265, 3.813771];

const METRES_PER_DEGREE_LAT = 110_574;
const METRES_PER_DEGREE_LON = 111_320 * Math.cos((ORIGIN[1] * Math.PI) / 180);

/** Local plan metres (east, north from the campus centroid) to WGS84. */
function at(eastMetres: number, northMetres: number): [number, number] {
  return [
    ORIGIN[0] + eastMetres / METRES_PER_DEGREE_LON,
    ORIGIN[1] + northMetres / METRES_PER_DEGREE_LAT,
  ];
}

function ring(points: [number, number][]): [number, number][] {
  const converted = points.map(([east, north]) => at(east, north));
  const first = converted[0];
  if (!first) throw new Error('A footprint needs at least one point.');
  return [...converted, first];
}

export const CAMPUS_BOUNDARY: CampusBoundary = {
  universitySlug: 'iai-cameroun',
  ring: BOUNDARY_RING,
  areaHectares: 4.6,
  source: 'OSM',
  sourceRef: {
    claim: 'Campus perimeter of the Institut Africain d’Informatique, Nkol Anga’a, tagged amenity=college',
    url: 'https://www.openstreetmap.org/way/455178620',
  },
};

export const BUILDINGS: Building[] = [
  {
    id: 'iai-b-ped',
    universitySlug: 'iai-cameroun',
    code: 'PED',
    name: 'Bâtiment Pédagogique',
    description:
      'The long green two-storey teaching block with a wing at each end, facing the central garden: lecture rooms and tutorial rooms for the engineering and analyst programmes.',
    coordinates: at(16, 2),
    // U-shaped: a north–south bar with two wings reaching west towards the garden.
    footprint: ring([
      [-10, 46],
      [24, 46],
      [24, -46],
      [-10, -46],
      [-10, -32],
      [10, -32],
      [10, 32],
      [-10, 32],
    ]),
    floors: [
      { id: 'iai-b-ped-0', level: 0, name: 'Rez-de-chaussée' },
      { id: 'iai-b-ped-1', level: 1, name: '1er étage' },
    ],
  },
  {
    id: 'iai-b-adm',
    universitySlug: 'iai-cameroun',
    code: 'ADM',
    name: 'Bloc Administratif',
    description:
      'Direction, scolarité, student affairs and the meeting rooms students can request. Its outline is the block mapped in OpenStreetMap on the north-west edge of the campus.',
    coordinates: at(-82, 59),
    // OSM way 1244927072 — the only building outline surveyed inside the perimeter.
    footprint: [
      [11.5576587, 3.8143904],
      [11.5576224, 3.8141807],
      [11.5573896, 3.8142208],
      [11.5574259, 3.8144306],
      [11.5576587, 3.8143904],
    ],
    floors: [
      { id: 'iai-b-adm-0', level: 0, name: 'Rez-de-chaussée' },
      { id: 'iai-b-adm-1', level: 1, name: '1er étage' },
    ],
  },
  {
    id: 'iai-b-cet',
    universitySlug: 'iai-cameroun',
    code: 'CET',
    name: 'Centre d’Excellence Technologique',
    description:
      'The long low block with the continuous verandah across the esplanade: computer laboratories, the library and the incubation space.',
    coordinates: at(96, -30),
    footprint: ring([
      [90, -70],
      [104, -70],
      [104, 10],
      [90, 10],
    ]),
    floors: [{ id: 'iai-b-cet-0', level: 0, name: 'Rez-de-chaussée' }],
  },
];

export const ROOMS: Room[] = [
  // Bâtiment Pédagogique — ground floor
  { id: 'r-ped-a01', buildingId: 'iai-b-ped', floorId: 'iai-b-ped-0', code: 'A01', name: 'Amphithéâtre A', kind: 'CLASSROOM', capacity: 180, bookable: false, nodeId: 'n-ped0-a01' },
  { id: 'r-ped-a02', buildingId: 'iai-b-ped', floorId: 'iai-b-ped-0', code: 'A02', name: 'Salle de TD 1', kind: 'CLASSROOM', capacity: 45, bookable: false, nodeId: 'n-ped0-a02' },
  { id: 'r-ped-a03', buildingId: 'iai-b-ped', floorId: 'iai-b-ped-0', code: 'A03', name: 'Salle de TD 2', kind: 'CLASSROOM', capacity: 45, bookable: false, nodeId: 'n-ped0-a03' },
  { id: 'r-ped-wc0', buildingId: 'iai-b-ped', floorId: 'iai-b-ped-0', code: 'WC-P0', name: 'Sanitaires', kind: 'AMENITY', capacity: 0, bookable: false, nodeId: 'n-ped0-wc' },
  // Bâtiment Pédagogique — first floor
  { id: 'r-ped-b11', buildingId: 'iai-b-ped', floorId: 'iai-b-ped-1', code: 'B11', name: 'Salle Réseaux', kind: 'LAB', capacity: 30, bookable: false, nodeId: 'n-ped1-b11' },
  { id: 'r-ped-b12', buildingId: 'iai-b-ped', floorId: 'iai-b-ped-1', code: 'B12', name: 'Salle de Projet', kind: 'CLASSROOM', capacity: 25, bookable: true, nodeId: 'n-ped1-b12' },

  // Bloc Administratif — ground floor
  { id: 'r-adm-s01', buildingId: 'iai-b-adm', floorId: 'iai-b-adm-0', code: 'S01', name: 'Scolarité — guichet', kind: 'ADMINISTRATIVE', capacity: 6, bookable: false, nodeId: 'n-adm0-s01' },
  { id: 'r-adm-s02', buildingId: 'iai-b-adm', floorId: 'iai-b-adm-0', code: 'S02', name: 'Bureau des Stages', kind: 'ADMINISTRATIVE', capacity: 4, bookable: true, nodeId: 'n-adm0-s02' },
  { id: 'r-adm-s03', buildingId: 'iai-b-adm', floorId: 'iai-b-adm-0', code: 'S03', name: 'Salle d’Entretien 1', kind: 'ADMINISTRATIVE', capacity: 8, bookable: true, nodeId: 'n-adm0-s03' },
  // Bloc Administratif — first floor
  { id: 'r-adm-d11', buildingId: 'iai-b-adm', floorId: 'iai-b-adm-1', code: 'D11', name: 'Salle du Conseil', kind: 'ADMINISTRATIVE', capacity: 20, bookable: true, nodeId: 'n-adm1-d11' },
  { id: 'r-adm-d12', buildingId: 'iai-b-adm', floorId: 'iai-b-adm-1', code: 'D12', name: 'Salle d’Entretien 2', kind: 'ADMINISTRATIVE', capacity: 6, bookable: true, nodeId: 'n-adm1-d12' },

  // Centre d'Excellence Technologique
  { id: 'r-cet-l01', buildingId: 'iai-b-cet', floorId: 'iai-b-cet-0', code: 'L01', name: 'Laboratoire Logiciel', kind: 'LAB', capacity: 40, bookable: false, nodeId: 'n-cet0-l01' },
  { id: 'r-cet-l02', buildingId: 'iai-b-cet', floorId: 'iai-b-cet-0', code: 'L02', name: 'Laboratoire Systèmes', kind: 'LAB', capacity: 40, bookable: false, nodeId: 'n-cet0-l02' },
  { id: 'r-cet-bib', buildingId: 'iai-b-cet', floorId: 'iai-b-cet-0', code: 'BIB', name: 'Bibliothèque', kind: 'LIBRARY', capacity: 80, bookable: false, nodeId: 'n-cet0-bib' },
];

interface NodeSeed {
  id: string;
  buildingId: string;
  floorId: string;
  label: string;
  x: number;
  y: number;
}

/**
 * The walking graph, in metres east/north of the campus centroid.
 *
 * Outdoor nodes (`n-out-*`) are attached to the building they stand in front of, so
 * a step on the esplanade still reports a sensible place name. Indoor nodes keep the
 * identifiers they have always had: printed QR anchors and saved bookings point at
 * them, and renaming a node to tidy the file would invalidate a sticker on a wall.
 */
const NODE_SEEDS: NodeSeed[] = [
  // ── Outdoors: the gate, the alley, the garden, the esplanade ────────────────
  { id: 'n-out-gate', buildingId: 'iai-b-adm', floorId: 'iai-b-adm-0', label: 'Portail principal', x: -101, y: 25 },
  { id: 'n-out-guard', buildingId: 'iai-b-adm', floorId: 'iai-b-adm-0', label: 'Poste de garde', x: -97, y: 29 },
  { id: 'n-out-adm-fork', buildingId: 'iai-b-adm', floorId: 'iai-b-adm-0', label: 'Allée — embranchement Administration', x: -84, y: 36 },
  { id: 'n-out-alley1', buildingId: 'iai-b-ped', floorId: 'iai-b-ped-0', label: 'Allée centrale — haut', x: -74, y: 20 },
  { id: 'n-out-flags', buildingId: 'iai-b-ped', floorId: 'iai-b-ped-0', label: 'Place des Drapeaux', x: -50, y: 14 },
  { id: 'n-out-fountain', buildingId: 'iai-b-ped', floorId: 'iai-b-ped-0', label: 'Fontaine du diplômé', x: -40, y: 6 },
  { id: 'n-out-garden', buildingId: 'iai-b-ped', floorId: 'iai-b-ped-0', label: 'Jardin central', x: -22, y: 8 },
  { id: 'n-out-statues', buildingId: 'iai-b-ped', floorId: 'iai-b-ped-0', label: 'Terrasse des statues', x: -34, y: -18 },
  { id: 'n-out-esplanade', buildingId: 'iai-b-cet', floorId: 'iai-b-cet-0', label: 'Esplanade IAI', x: 56, y: -34 },
  { id: 'n-out-parking', buildingId: 'iai-b-cet', floorId: 'iai-b-cet-0', label: 'Parking', x: 70, y: -56 },

  // ── Bâtiment Pédagogique, rez-de-chaussée ───────────────────────────────────
  { id: 'n-ped0-entrance', buildingId: 'iai-b-ped', floorId: 'iai-b-ped-0', label: 'Entrée Pédagogique', x: 8, y: 2 },
  { id: 'n-ped0-hall', buildingId: 'iai-b-ped', floorId: 'iai-b-ped-0', label: 'Hall PED', x: 15, y: 2 },
  { id: 'n-ped0-c1', buildingId: 'iai-b-ped', floorId: 'iai-b-ped-0', label: 'Couloir PED rez — nord', x: 15, y: 20 },
  { id: 'n-ped0-c2', buildingId: 'iai-b-ped', floorId: 'iai-b-ped-0', label: 'Couloir PED rez — sud', x: 15, y: -20 },
  { id: 'n-ped0-a01', buildingId: 'iai-b-ped', floorId: 'iai-b-ped-0', label: 'Amphithéâtre A', x: 20, y: 38 },
  { id: 'n-ped0-a02', buildingId: 'iai-b-ped', floorId: 'iai-b-ped-0', label: 'Salle de TD 1', x: 20, y: 24 },
  { id: 'n-ped0-a03', buildingId: 'iai-b-ped', floorId: 'iai-b-ped-0', label: 'Salle de TD 2', x: 20, y: -24 },
  { id: 'n-ped0-wc', buildingId: 'iai-b-ped', floorId: 'iai-b-ped-0', label: 'Sanitaires PED', x: 20, y: -38 },
  { id: 'n-ped0-stairs', buildingId: 'iai-b-ped', floorId: 'iai-b-ped-0', label: 'Escalier PED rez', x: 18, y: 8 },
  // ── Bâtiment Pédagogique, 1er étage ─────────────────────────────────────────
  { id: 'n-ped1-stairs', buildingId: 'iai-b-ped', floorId: 'iai-b-ped-1', label: 'Escalier PED 1er', x: 18, y: 8 },
  { id: 'n-ped1-c1', buildingId: 'iai-b-ped', floorId: 'iai-b-ped-1', label: 'Couloir PED 1er', x: 15, y: 14 },
  { id: 'n-ped1-b11', buildingId: 'iai-b-ped', floorId: 'iai-b-ped-1', label: 'Salle Réseaux', x: 20, y: 28 },
  { id: 'n-ped1-b12', buildingId: 'iai-b-ped', floorId: 'iai-b-ped-1', label: 'Salle de Projet', x: 20, y: 0 },

  // ── The court between the blocks (kept: an anchor is printed here) ──────────
  { id: 'n-court-w', buildingId: 'iai-b-ped', floorId: 'iai-b-ped-0', label: 'Cour — côté ouest', x: -4, y: 2 },
  { id: 'n-court-c', buildingId: 'iai-b-ped', floorId: 'iai-b-ped-0', label: 'Cour centrale', x: 32, y: -16 },
  { id: 'n-court-e', buildingId: 'iai-b-cet', floorId: 'iai-b-cet-0', label: 'Cour — côté est', x: 74, y: -28 },

  // ── Bloc Administratif, rez-de-chaussée ─────────────────────────────────────
  { id: 'n-adm0-entrance', buildingId: 'iai-b-adm', floorId: 'iai-b-adm-0', label: 'Entrée Administration', x: -82, y: 46 },
  { id: 'n-adm0-hall', buildingId: 'iai-b-adm', floorId: 'iai-b-adm-0', label: 'Hall ADM', x: -82, y: 54 },
  { id: 'n-adm0-c1', buildingId: 'iai-b-adm', floorId: 'iai-b-adm-0', label: 'Couloir ADM rez', x: -82, y: 60 },
  { id: 'n-adm0-s01', buildingId: 'iai-b-adm', floorId: 'iai-b-adm-0', label: 'Scolarité', x: -90, y: 62 },
  { id: 'n-adm0-s02', buildingId: 'iai-b-adm', floorId: 'iai-b-adm-0', label: 'Bureau des Stages', x: -74, y: 62 },
  { id: 'n-adm0-s03', buildingId: 'iai-b-adm', floorId: 'iai-b-adm-0', label: 'Salle d’Entretien 1', x: -74, y: 68 },
  { id: 'n-adm0-stairs', buildingId: 'iai-b-adm', floorId: 'iai-b-adm-0', label: 'Escalier ADM rez', x: -86, y: 57 },
  { id: 'n-adm0-lift', buildingId: 'iai-b-adm', floorId: 'iai-b-adm-0', label: 'Ascenseur ADM rez', x: -78, y: 57 },
  // ── Bloc Administratif, 1er étage ───────────────────────────────────────────
  { id: 'n-adm1-stairs', buildingId: 'iai-b-adm', floorId: 'iai-b-adm-1', label: 'Escalier ADM 1er', x: -86, y: 57 },
  { id: 'n-adm1-lift', buildingId: 'iai-b-adm', floorId: 'iai-b-adm-1', label: 'Ascenseur ADM 1er', x: -78, y: 57 },
  { id: 'n-adm1-c1', buildingId: 'iai-b-adm', floorId: 'iai-b-adm-1', label: 'Couloir ADM 1er', x: -82, y: 60 },
  { id: 'n-adm1-d11', buildingId: 'iai-b-adm', floorId: 'iai-b-adm-1', label: 'Salle du Conseil', x: -88, y: 66 },
  { id: 'n-adm1-d12', buildingId: 'iai-b-adm', floorId: 'iai-b-adm-1', label: 'Salle d’Entretien 2', x: -76, y: 66 },

  // ── Centre d'Excellence Technologique ───────────────────────────────────────
  { id: 'n-cet0-entrance', buildingId: 'iai-b-cet', floorId: 'iai-b-cet-0', label: 'Entrée CET', x: 90, y: -28 },
  { id: 'n-cet0-hall', buildingId: 'iai-b-cet', floorId: 'iai-b-cet-0', label: 'Hall CET', x: 96, y: -28 },
  { id: 'n-cet0-l01', buildingId: 'iai-b-cet', floorId: 'iai-b-cet-0', label: 'Laboratoire Logiciel', x: 98, y: -8 },
  { id: 'n-cet0-l02', buildingId: 'iai-b-cet', floorId: 'iai-b-cet-0', label: 'Laboratoire Systèmes', x: 98, y: -46 },
  { id: 'n-cet0-bib', buildingId: 'iai-b-cet', floorId: 'iai-b-cet-0', label: 'Bibliothèque', x: 98, y: -62 },
];

export const NAV_NODES: NavNode[] = NODE_SEEDS.map((seed) => ({ ...seed, coordinates: at(seed.x, seed.y) }));

const EDGE_SEEDS: [string, string, NavEdge['kind'], boolean][] = [
  // Outdoors — the gate to everything else
  ['n-out-gate', 'n-out-guard', 'PATH', true],
  ['n-out-guard', 'n-out-alley1', 'PATH', true],
  ['n-out-guard', 'n-out-adm-fork', 'PATH', true],
  ['n-out-adm-fork', 'n-adm0-entrance', 'PATH', true],
  ['n-out-alley1', 'n-out-flags', 'PATH', true],
  ['n-out-flags', 'n-out-fountain', 'PATH', true],
  ['n-out-fountain', 'n-out-garden', 'PATH', true],
  ['n-out-fountain', 'n-out-statues', 'PATH', true],
  ['n-out-garden', 'n-court-w', 'PATH', true],
  ['n-out-statues', 'n-court-c', 'PATH', true],
  ['n-court-w', 'n-ped0-entrance', 'PATH', true],
  ['n-court-c', 'n-out-esplanade', 'PATH', true],
  ['n-out-esplanade', 'n-out-parking', 'PATH', true],
  ['n-out-esplanade', 'n-court-e', 'PATH', true],
  ['n-court-e', 'n-cet0-entrance', 'PATH', true],

  // Bâtiment Pédagogique
  ['n-ped0-entrance', 'n-ped0-hall', 'DOOR', true],
  ['n-ped0-hall', 'n-ped0-c1', 'CORRIDOR', true],
  ['n-ped0-hall', 'n-ped0-c2', 'CORRIDOR', true],
  ['n-ped0-c1', 'n-ped0-a01', 'DOOR', true],
  ['n-ped0-c1', 'n-ped0-a02', 'DOOR', true],
  ['n-ped0-c2', 'n-ped0-a03', 'DOOR', true],
  ['n-ped0-c2', 'n-ped0-wc', 'DOOR', true],
  ['n-ped0-hall', 'n-ped0-stairs', 'CORRIDOR', true],
  ['n-ped0-stairs', 'n-ped1-stairs', 'STAIRS', false],
  ['n-ped1-stairs', 'n-ped1-c1', 'CORRIDOR', true],
  ['n-ped1-c1', 'n-ped1-b11', 'DOOR', true],
  ['n-ped1-c1', 'n-ped1-b12', 'DOOR', true],

  // Bloc Administratif
  ['n-adm0-entrance', 'n-adm0-hall', 'DOOR', true],
  ['n-adm0-hall', 'n-adm0-c1', 'CORRIDOR', true],
  ['n-adm0-c1', 'n-adm0-s01', 'DOOR', true],
  ['n-adm0-c1', 'n-adm0-s02', 'DOOR', true],
  ['n-adm0-c1', 'n-adm0-s03', 'DOOR', true],
  ['n-adm0-hall', 'n-adm0-stairs', 'CORRIDOR', true],
  ['n-adm0-hall', 'n-adm0-lift', 'CORRIDOR', true],
  ['n-adm0-stairs', 'n-adm1-stairs', 'STAIRS', false],
  ['n-adm0-lift', 'n-adm1-lift', 'LIFT', true],
  ['n-adm1-stairs', 'n-adm1-c1', 'CORRIDOR', true],
  ['n-adm1-lift', 'n-adm1-c1', 'CORRIDOR', true],
  ['n-adm1-c1', 'n-adm1-d11', 'DOOR', true],
  ['n-adm1-c1', 'n-adm1-d12', 'DOOR', true],

  // Centre d'Excellence
  ['n-cet0-entrance', 'n-cet0-hall', 'DOOR', true],
  ['n-cet0-hall', 'n-cet0-l01', 'CORRIDOR', true],
  ['n-cet0-hall', 'n-cet0-l02', 'CORRIDOR', true],
  ['n-cet0-l02', 'n-cet0-bib', 'DOOR', true],
];

export const NAV_EDGES: NavEdge[] = EDGE_SEEDS.map(([from, to, kind, accessible]) => ({ from, to, kind, accessible }));

/**
 * What a student navigates by.
 *
 * Each of these is visible in a photograph of the campus, which is why the outdoor
 * instructions can name them instead of counting metres.
 */
export const LANDMARKS: Landmark[] = [
  {
    id: 'lm-gate',
    universitySlug: 'iai-cameroun',
    kind: 'GATE',
    name: 'Portail principal',
    description: 'The brick-pillared gate with the arched IAI lettering, on the campus road.',
    coordinates: at(-101, 25),
    nodeId: 'n-out-gate',
    source: 'PHOTO_SURVEY',
  },
  {
    id: 'lm-flags',
    universitySlug: 'iai-cameroun',
    kind: 'PLAZA',
    name: 'Place des Drapeaux',
    description: 'The line of flagpoles flying the colours of the IAI member states, beside the welcome sign.',
    coordinates: at(-50, 14),
    nodeId: 'n-out-flags',
    source: 'PHOTO_SURVEY',
  },
  {
    id: 'lm-fountain',
    universitySlug: 'iai-cameroun',
    kind: 'FOUNTAIN',
    name: 'Fontaine du diplômé',
    description: 'The rock fountain with the statue of a graduate pouring water, next to the "Welcome to IAI-Cameroon" board.',
    coordinates: at(-40, 6),
    nodeId: 'n-out-fountain',
    source: 'PHOTO_SURVEY',
  },
  {
    id: 'lm-statues',
    universitySlug: 'iai-cameroun',
    kind: 'MONUMENT',
    name: 'Statues des étudiants',
    description: 'Two students seated back to back on a paved terrace of log benches, looking over the valley.',
    coordinates: at(-34, -18),
    nodeId: 'n-out-statues',
    source: 'PHOTO_SURVEY',
  },
  {
    id: 'lm-garden',
    universitySlug: 'iai-cameroun',
    kind: 'GARDEN',
    name: 'Jardin central',
    description: 'The clipped hedges and conifers in front of the teaching block, crossed by the paved alley.',
    coordinates: at(-22, 8),
    nodeId: 'n-out-garden',
    source: 'PHOTO_SURVEY',
  },
  {
    id: 'lm-esplanade',
    universitySlug: 'iai-cameroun',
    kind: 'PLAZA',
    name: 'Esplanade IAI',
    description: 'The tarmac forecourt with IAI painted across it in white, in front of the Centre d’Excellence.',
    coordinates: at(56, -34),
    nodeId: 'n-out-esplanade',
    source: 'PHOTO_SURVEY',
  },
  {
    id: 'lm-parking',
    universitySlug: 'iai-cameroun',
    kind: 'PARKING',
    name: 'Parking',
    description: 'Marked parking bays at the lower end of the esplanade.',
    coordinates: at(70, -56),
    nodeId: 'n-out-parking',
    source: 'PHOTO_SURVEY',
  },
  {
    id: 'lm-viewpoint',
    universitySlug: 'iai-cameroun',
    kind: 'VIEWPOINT',
    name: 'Belvédère de Nkol Anga’a',
    description: 'The southern edge of the campus, open over the Yaoundé hills — the campus sits on a crest.',
    coordinates: at(-20, -70),
    nodeId: null,
    source: 'PHOTO_SURVEY',
  },
];

/** Printed anchors. The code is what the student's camera reads. */
export const QR_ANCHORS: QrAnchor[] = [
  { code: 'IAI-PORTAIL', buildingId: 'iai-b-adm', floorId: 'iai-b-adm-0', nodeId: 'n-out-gate', label: 'Portail principal' },
  { code: 'IAI-PED-ENT', buildingId: 'iai-b-ped', floorId: 'iai-b-ped-0', nodeId: 'n-ped0-entrance', label: 'Entrée du Bâtiment Pédagogique' },
  { code: 'IAI-PED-HALL', buildingId: 'iai-b-ped', floorId: 'iai-b-ped-0', nodeId: 'n-ped0-hall', label: 'Hall du Bâtiment Pédagogique' },
  { code: 'IAI-PED-1ET', buildingId: 'iai-b-ped', floorId: 'iai-b-ped-1', nodeId: 'n-ped1-c1', label: 'Couloir du 1er étage — Pédagogique' },
  { code: 'IAI-ADM-ENT', buildingId: 'iai-b-adm', floorId: 'iai-b-adm-0', nodeId: 'n-adm0-entrance', label: 'Entrée du Bloc Administratif' },
  { code: 'IAI-ADM-HALL', buildingId: 'iai-b-adm', floorId: 'iai-b-adm-0', nodeId: 'n-adm0-hall', label: 'Hall du Bloc Administratif' },
  { code: 'IAI-ADM-1ET', buildingId: 'iai-b-adm', floorId: 'iai-b-adm-1', nodeId: 'n-adm1-c1', label: 'Couloir du 1er étage — Administration' },
  { code: 'IAI-CET-ENT', buildingId: 'iai-b-cet', floorId: 'iai-b-cet-0', nodeId: 'n-cet0-entrance', label: 'Entrée du Centre d’Excellence' },
  { code: 'IAI-ESPLANADE', buildingId: 'iai-b-cet', floorId: 'iai-b-cet-0', nodeId: 'n-out-esplanade', label: 'Esplanade IAI' },
  { code: 'IAI-COUR', buildingId: 'iai-b-ped', floorId: 'iai-b-ped-0', nodeId: 'n-court-c', label: 'Cour centrale' },
];

export function nodeById(id: string): NavNode | undefined {
  return NAV_NODES.find((node) => node.id === id);
}

export function roomById(id: string): Room | undefined {
  return ROOMS.find((room) => room.id === id);
}

export function buildingById(id: string): Building | undefined {
  return BUILDINGS.find((building) => building.id === id);
}

export function landmarkById(id: string): Landmark | undefined {
  return LANDMARKS.find((landmark) => landmark.id === id);
}

export function floorName(buildingId: string, floorId: string): string {
  return buildingById(buildingId)?.floors.find((floor) => floor.id === floorId)?.name ?? 'Niveau inconnu';
}

/** True when a point lies inside the surveyed perimeter — used by the tests. */
export function insideCampus([lon, lat]: [number, number]): boolean {
  let inside = false;
  for (let i = 0, j = BOUNDARY_RING.length - 1; i < BOUNDARY_RING.length; j = i++) {
    const [xi, yi] = BOUNDARY_RING[i] as [number, number];
    const [xj, yj] = BOUNDARY_RING[j] as [number, number];
    const intersects = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}
