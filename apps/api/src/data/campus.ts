import type { Building, CampusBoundary, Landmark, NavEdge, NavNode, QrAnchor, Room } from '../types.ts';
import { generateBlock, type BlockSpec } from './floorplan.ts';

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

/**
 * The three blocks, described in metres.
 *
 * Each block is a corridor with rooms along it; `floorplan.ts` turns these numbers
 * into room polygons, doors, corridor nodes and the walking graph. Every dimension
 * here is an estimate read off the photographs — the teaching block's 92 m frontage,
 * its two storeys, the long low Centre d'Excellence across the esplanade — except
 * the administration block's envelope, which is the OpenStreetMap outline.
 *
 * Room numbers encode the floor: `P104` is block P, floor 1, room 04. Odd numbers
 * are on the left walking in from the corridor's origin, even numbers on the right.
 */
const BLOCKS: BlockSpec[] = [
  {
    buildingId: 'iai-b-ped',
    letter: 'P',
    name: 'Bâtiment Pédagogique',
    slug: 'ped',
    // Corridor runs south → north up the middle of the 92 × 16 m teaching bar.
    origin: [17, -43],
    bearingDeg: 90,
    floors: [
      {
        id: 'iai-b-ped-0',
        level: 0,
        name: 'Rez-de-chaussée',
        corridorLength: 86,
        stairsAt: 6,
        liftAt: null,
        entranceAt: 45,
        entranceSide: 'ODD',
        rooms: [
          { id: 'r-ped-a01', number: '01', name: 'Amphithéâtre A', kind: 'CLASSROOM', capacity: 180, bookable: false, side: 'ODD', start: 2, length: 28, depth: 6.8 },
          { id: 'r-ped-a02', number: '03', name: 'Salle de TD 1', kind: 'CLASSROOM', capacity: 45, bookable: false, side: 'ODD', start: 32, length: 16, depth: 6.8 },
          { id: 'r-ped-a03', number: '05', name: 'Salle de TD 2', kind: 'CLASSROOM', capacity: 45, bookable: false, side: 'ODD', start: 50, length: 16, depth: 6.8 },
          { id: 'r-ped-p007', number: '07', name: 'Salle informatique 1', kind: 'LAB', capacity: 40, bookable: false, side: 'ODD', start: 68, length: 16, depth: 6.8 },
          { id: 'r-ped-wc0', number: '02', name: 'Sanitaires', kind: 'AMENITY', capacity: 0, bookable: false, side: 'EVEN', start: 2, length: 8, depth: 6.8 },
          { id: 'r-ped-p004', number: '04', name: 'Bureau des surveillants', kind: 'ADMINISTRATIVE', capacity: 6, bookable: false, side: 'EVEN', start: 12, length: 8, depth: 6.8 },
          { id: 'r-ped-p006', number: '06', name: 'Salle de TD 3', kind: 'CLASSROOM', capacity: 45, bookable: false, side: 'EVEN', start: 22, length: 16, depth: 6.8 },
          { id: 'r-ped-p008', number: '08', name: 'Salle de TD 4', kind: 'CLASSROOM', capacity: 45, bookable: false, side: 'EVEN', start: 40, length: 16, depth: 6.8 },
          { id: 'r-ped-p010', number: '10', name: 'Foyer des étudiants', kind: 'AMENITY', capacity: 120, bookable: false, side: 'EVEN', start: 58, length: 24, depth: 6.8 },
        ],
      },
      {
        id: 'iai-b-ped-1',
        level: 1,
        name: '1er étage',
        corridorLength: 86,
        stairsAt: 6,
        liftAt: null,
        rooms: [
          { id: 'r-ped-b11', number: '01', name: 'Salle Réseaux', kind: 'LAB', capacity: 30, bookable: false, side: 'ODD', start: 2, length: 18, depth: 6.8 },
          { id: 'r-ped-b12', number: '03', name: 'Salle de Projet', kind: 'CLASSROOM', capacity: 25, bookable: true, side: 'ODD', start: 22, length: 14, depth: 6.8 },
          { id: 'r-ped-p105', number: '05', name: 'Salle de TD 5', kind: 'CLASSROOM', capacity: 45, bookable: false, side: 'ODD', start: 38, length: 16, depth: 6.8 },
          { id: 'r-ped-p107', number: '07', name: 'Laboratoire Matériel', kind: 'LAB', capacity: 30, bookable: false, side: 'ODD', start: 56, length: 16, depth: 6.8 },
          { id: 'r-ped-p102', number: '02', name: 'Sanitaires', kind: 'AMENITY', capacity: 0, bookable: false, side: 'EVEN', start: 2, length: 8, depth: 6.8 },
          { id: 'r-ped-p104', number: '04', name: 'Salle de TD 6', kind: 'CLASSROOM', capacity: 45, bookable: false, side: 'EVEN', start: 12, length: 16, depth: 6.8 },
          { id: 'r-ped-p106', number: '06', name: 'Salle de TD 7', kind: 'CLASSROOM', capacity: 45, bookable: false, side: 'EVEN', start: 30, length: 16, depth: 6.8 },
          { id: 'r-ped-p108', number: '08', name: 'Salle des enseignants', kind: 'ADMINISTRATIVE', capacity: 20, bookable: false, side: 'EVEN', start: 48, length: 16, depth: 6.8 },
        ],
      },
    ],
  },
  {
    buildingId: 'iai-b-adm',
    letter: 'A',
    name: 'Administration',
    slug: 'adm',
    // Corridor along the long axis of the OSM-mapped 26.2 × 23.5 m block.
    origin: [-93.2, 61],
    bearingDeg: -9.7,
    floors: [
      {
        id: 'iai-b-adm-0',
        level: 0,
        name: 'Rez-de-chaussée',
        corridorLength: 22,
        stairsAt: 8,
        liftAt: 12,
        entranceAt: 4,
        entranceSide: 'EVEN',
        rooms: [
          { id: 'r-adm-s01', number: '01', name: 'Scolarité — guichet', kind: 'ADMINISTRATIVE', capacity: 6, bookable: false, side: 'ODD', start: 0, length: 8, depth: 10.5 },
          { id: 'r-adm-a003', number: '03', name: 'Service des examens', kind: 'ADMINISTRATIVE', capacity: 4, bookable: false, side: 'ODD', start: 9, length: 6, depth: 10.5 },
          { id: 'r-adm-s02', number: '05', name: 'Bureau des Stages', kind: 'ADMINISTRATIVE', capacity: 4, bookable: true, side: 'ODD', start: 16, length: 6, depth: 10.5 },
          { id: 'r-adm-a002', number: '02', name: 'Accueil', kind: 'ADMINISTRATIVE', capacity: 10, bookable: false, side: 'EVEN', start: 0, length: 6, depth: 10.5 },
          { id: 'r-adm-s03', number: '04', name: 'Salle d’Entretien 1', kind: 'ADMINISTRATIVE', capacity: 8, bookable: true, side: 'EVEN', start: 7, length: 6, depth: 10.5 },
          { id: 'r-adm-a006', number: '06', name: 'Sanitaires', kind: 'AMENITY', capacity: 0, bookable: false, side: 'EVEN', start: 13, length: 4, depth: 10.5 },
          { id: 'r-adm-a008', number: '08', name: 'Économat', kind: 'ADMINISTRATIVE', capacity: 4, bookable: false, side: 'EVEN', start: 17.5, length: 4, depth: 10.5 },
        ],
      },
      {
        id: 'iai-b-adm-1',
        level: 1,
        name: '1er étage',
        corridorLength: 22,
        stairsAt: 8,
        liftAt: 12,
        rooms: [
          { id: 'r-adm-d11', number: '01', name: 'Salle du Conseil', kind: 'ADMINISTRATIVE', capacity: 20, bookable: true, side: 'ODD', start: 0, length: 10, depth: 10.5 },
          { id: 'r-adm-a103', number: '03', name: 'Direction', kind: 'ADMINISTRATIVE', capacity: 6, bookable: false, side: 'ODD', start: 11, length: 6, depth: 10.5 },
          { id: 'r-adm-a105', number: '05', name: 'Secrétariat de direction', kind: 'ADMINISTRATIVE', capacity: 4, bookable: false, side: 'ODD', start: 18, length: 4, depth: 10.5 },
          { id: 'r-adm-d12', number: '02', name: 'Salle d’Entretien 2', kind: 'ADMINISTRATIVE', capacity: 6, bookable: true, side: 'EVEN', start: 0, length: 6, depth: 10.5 },
          { id: 'r-adm-a104', number: '04', name: 'Comptabilité', kind: 'ADMINISTRATIVE', capacity: 6, bookable: false, side: 'EVEN', start: 7, length: 6, depth: 10.5 },
          { id: 'r-adm-a106', number: '06', name: 'Archives', kind: 'ADMINISTRATIVE', capacity: 2, bookable: false, side: 'EVEN', start: 13, length: 4.5, depth: 10.5 },
          { id: 'r-adm-a108', number: '08', name: 'Sanitaires', kind: 'AMENITY', capacity: 0, bookable: false, side: 'EVEN', start: 18, length: 4, depth: 10.5 },
        ],
      },
    ],
  },
  {
    buildingId: 'iai-b-cet',
    letter: 'C',
    name: 'Centre d’Excellence',
    slug: 'cet',
    // Corridor runs south → north behind the verandah of the 80 × 16 m low block.
    origin: [97, -66],
    bearingDeg: 90,
    floors: [
      {
        id: 'iai-b-cet-0',
        level: 0,
        name: 'Rez-de-chaussée',
        corridorLength: 72,
        stairsAt: null,
        liftAt: null,
        entranceAt: 38,
        entranceSide: 'ODD',
        rooms: [
          { id: 'r-cet-l01', number: '01', name: 'Laboratoire Logiciel', kind: 'LAB', capacity: 40, bookable: false, side: 'ODD', start: 2, length: 18, depth: 6.3 },
          { id: 'r-cet-l02', number: '03', name: 'Laboratoire Systèmes', kind: 'LAB', capacity: 40, bookable: false, side: 'ODD', start: 22, length: 18, depth: 6.3 },
          { id: 'r-cet-c05', number: '05', name: 'Salle d’incubation', kind: 'LAB', capacity: 25, bookable: true, side: 'ODD', start: 44, length: 14, depth: 6.3 },
          { id: 'r-cet-c07', number: '07', name: 'Salle serveur', kind: 'AMENITY', capacity: 0, bookable: false, side: 'ODD', start: 60, length: 8, depth: 6.3 },
          { id: 'r-cet-bib', number: '02', name: 'Bibliothèque', kind: 'LIBRARY', capacity: 80, bookable: false, side: 'EVEN', start: 2, length: 28, depth: 6.3 },
          { id: 'r-cet-c04', number: '04', name: 'Salle de lecture', kind: 'LIBRARY', capacity: 30, bookable: false, side: 'EVEN', start: 32, length: 16, depth: 6.3 },
          { id: 'r-cet-c06', number: '06', name: 'Sanitaires', kind: 'AMENITY', capacity: 0, bookable: false, side: 'EVEN', start: 50, length: 6, depth: 6.3 },
          { id: 'r-cet-c08', number: '08', name: 'Reprographie', kind: 'AMENITY', capacity: 4, bookable: false, side: 'EVEN', start: 58, length: 8, depth: 6.3 },
        ],
      },
    ],
  },
];

const PLANS = BLOCKS.map((block) => ({ block, generated: generateBlock(block, at) }));

function floorsOf(buildingId: string) {
  return PLANS.find((plan) => plan.block.buildingId === buildingId)?.generated.floors.map((entry) => entry.floor) ?? [];
}

export const ROOMS: Room[] = PLANS.flatMap((plan) => plan.generated.rooms);

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
      [-10, 46.6],
      [25.6, 46.6],
      [25.6, -46.6],
      [-10, -46.6],
      [-10, -32],
      [8.4, -32],
      [8.4, 32],
      [-10, 32],
    ]),
    floors: floorsOf('iai-b-ped'),
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
    floors: floorsOf('iai-b-adm'),
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
      [88.4, -70],
      [105.6, -70],
      [105.6, 10],
      [88.4, 10],
    ]),
    floors: floorsOf('iai-b-cet'),
  },
];


/**
 * Outdoors: the gate, the alley past the flagpoles and the fountain, the court and
 * the esplanade. Indoor nodes are generated from the floor plans; these are the ones
 * placed by hand from the photographs.
 */
interface OutdoorSeed {
  id: string;
  buildingId: string;
  floorId: string;
  label: string;
  x: number;
  y: number;
}

const OUTDOOR_SEEDS: OutdoorSeed[] = [
  { id: 'n-out-gate', buildingId: 'iai-b-adm', floorId: 'iai-b-adm-0', label: 'Portail principal', x: -101, y: 25 },
  { id: 'n-out-guard', buildingId: 'iai-b-adm', floorId: 'iai-b-adm-0', label: 'Poste de garde', x: -97, y: 29 },
  { id: 'n-out-adm-fork', buildingId: 'iai-b-adm', floorId: 'iai-b-adm-0', label: 'Allée — embranchement Administration', x: -88, y: 40 },
  { id: 'n-out-alley1', buildingId: 'iai-b-ped', floorId: 'iai-b-ped-0', label: 'Allée centrale — haut', x: -74, y: 20 },
  { id: 'n-out-flags', buildingId: 'iai-b-ped', floorId: 'iai-b-ped-0', label: 'Place des Drapeaux', x: -50, y: 14 },
  { id: 'n-out-fountain', buildingId: 'iai-b-ped', floorId: 'iai-b-ped-0', label: 'Fontaine du diplômé', x: -40, y: 6 },
  { id: 'n-out-garden', buildingId: 'iai-b-ped', floorId: 'iai-b-ped-0', label: 'Jardin central', x: -22, y: 8 },
  { id: 'n-out-statues', buildingId: 'iai-b-ped', floorId: 'iai-b-ped-0', label: 'Terrasse des statues', x: -34, y: -18 },
  { id: 'n-court-w', buildingId: 'iai-b-ped', floorId: 'iai-b-ped-0', label: 'Cour — côté ouest', x: -4, y: 2 },
  { id: 'n-court-c', buildingId: 'iai-b-ped', floorId: 'iai-b-ped-0', label: 'Cour centrale', x: 34, y: -16 },
  { id: 'n-court-e', buildingId: 'iai-b-cet', floorId: 'iai-b-cet-0', label: 'Cour — côté est', x: 74, y: -28 },
  { id: 'n-out-esplanade', buildingId: 'iai-b-cet', floorId: 'iai-b-cet-0', label: 'Esplanade IAI', x: 56, y: -34 },
  { id: 'n-out-parking', buildingId: 'iai-b-cet', floorId: 'iai-b-cet-0', label: 'Parking', x: 70, y: -56 },
];

const OUTDOOR_NODES: NavNode[] = OUTDOOR_SEEDS.map((seed) => ({ ...seed, coordinates: at(seed.x, seed.y) }));

const OUTDOOR_EDGES: [string, string][] = [
  ['n-out-gate', 'n-out-guard'],
  ['n-out-guard', 'n-out-alley1'],
  ['n-out-guard', 'n-out-adm-fork'],
  ['n-out-adm-fork', 'n-adm0-entrance'],
  ['n-out-alley1', 'n-out-flags'],
  ['n-out-flags', 'n-out-fountain'],
  ['n-out-fountain', 'n-out-garden'],
  ['n-out-fountain', 'n-out-statues'],
  ['n-out-garden', 'n-court-w'],
  ['n-out-statues', 'n-court-c'],
  ['n-court-w', 'n-ped0-entrance'],
  ['n-court-c', 'n-out-esplanade'],
  ['n-out-esplanade', 'n-out-parking'],
  ['n-out-esplanade', 'n-court-e'],
  ['n-court-e', 'n-cet0-entrance'],
];

export const NAV_NODES: NavNode[] = [...OUTDOOR_NODES, ...PLANS.flatMap((plan) => plan.generated.nodes)];

export const NAV_EDGES: NavEdge[] = [
  ...OUTDOOR_EDGES.map(([from, to]) => ({ from, to, kind: 'PATH' as const, accessible: true })),
  ...PLANS.flatMap((plan) => plan.generated.edges),
];

/** The floors of a block, in order, with their corridor geometry. */
export function floorsOfBuilding(buildingId: string) {
  return floorsOf(buildingId);
}

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
