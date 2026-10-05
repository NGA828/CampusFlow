import type { Building, NavEdge, NavNode, QrAnchor, Room } from '../types.ts';

/**
 * The IAI Cameroun pilot campus.
 *
 * This is the one campus CampusFlow maps indoors: buildings, floors, rooms, printed
 * QR anchors and the walking graph used for indoor routes. The layout is a working
 * model of the Nkol Anga'a campus (three blocks around a central court), detailed
 * enough to exercise scanning, routing and room booking end to end. It is explicitly
 * *not* a survey: `accuracy` on the institution says `CAMPUS_POINT`, and every screen
 * that shows an indoor route also says which campus model it came from.
 */

const CAMPUS: [number, number] = [11.55852, 3.81384];

/** Convert local plan metres to WGS84 near the campus, so indoor nodes can be drawn on the map. */
function at(eastMetres: number, northMetres: number): [number, number] {
  const metresPerDegreeLat = 110_574;
  const metresPerDegreeLon = 111_320 * Math.cos((CAMPUS[1] * Math.PI) / 180);
  return [CAMPUS[0] + eastMetres / metresPerDegreeLon, CAMPUS[1] + northMetres / metresPerDegreeLat];
}

export const BUILDINGS: Building[] = [
  {
    id: 'iai-b-ped',
    universitySlug: 'iai-cameroun',
    code: 'PED',
    name: 'Bâtiment Pédagogique',
    description: 'Lecture rooms and tutorial rooms for the engineering and analyst programmes.',
    coordinates: at(-30, 10),
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
    description: 'Direction, scolarité, student affairs and the meeting rooms students can request.',
    coordinates: at(25, 35),
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
    description: 'Computer laboratories, the library and the incubation space.',
    coordinates: at(40, -30),
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

const NODE_SEEDS: NodeSeed[] = [
  // Pédagogique ground floor corridor
  { id: 'n-ped0-entrance', buildingId: 'iai-b-ped', floorId: 'iai-b-ped-0', label: 'Entrée Pédagogique', x: -30, y: 0 },
  { id: 'n-ped0-hall', buildingId: 'iai-b-ped', floorId: 'iai-b-ped-0', label: 'Hall PED', x: -30, y: 6 },
  { id: 'n-ped0-c1', buildingId: 'iai-b-ped', floorId: 'iai-b-ped-0', label: 'Couloir PED rez 1', x: -36, y: 10 },
  { id: 'n-ped0-c2', buildingId: 'iai-b-ped', floorId: 'iai-b-ped-0', label: 'Couloir PED rez 2', x: -24, y: 10 },
  { id: 'n-ped0-a01', buildingId: 'iai-b-ped', floorId: 'iai-b-ped-0', label: 'Amphithéâtre A', x: -40, y: 14 },
  { id: 'n-ped0-a02', buildingId: 'iai-b-ped', floorId: 'iai-b-ped-0', label: 'Salle de TD 1', x: -30, y: 15 },
  { id: 'n-ped0-a03', buildingId: 'iai-b-ped', floorId: 'iai-b-ped-0', label: 'Salle de TD 2', x: -20, y: 15 },
  { id: 'n-ped0-wc', buildingId: 'iai-b-ped', floorId: 'iai-b-ped-0', label: 'Sanitaires PED', x: -18, y: 7 },
  { id: 'n-ped0-stairs', buildingId: 'iai-b-ped', floorId: 'iai-b-ped-0', label: 'Escalier PED rez', x: -27, y: 9 },
  // Pédagogique first floor
  { id: 'n-ped1-stairs', buildingId: 'iai-b-ped', floorId: 'iai-b-ped-1', label: 'Escalier PED 1er', x: -27, y: 9 },
  { id: 'n-ped1-c1', buildingId: 'iai-b-ped', floorId: 'iai-b-ped-1', label: 'Couloir PED 1er', x: -30, y: 11 },
  { id: 'n-ped1-b11', buildingId: 'iai-b-ped', floorId: 'iai-b-ped-1', label: 'Salle Réseaux', x: -36, y: 14 },
  { id: 'n-ped1-b12', buildingId: 'iai-b-ped', floorId: 'iai-b-ped-1', label: 'Salle de Projet', x: -24, y: 14 },

  // Cour centrale (outdoor link between blocks)
  { id: 'n-court-w', buildingId: 'iai-b-ped', floorId: 'iai-b-ped-0', label: 'Cour — côté ouest', x: -16, y: 2 },
  { id: 'n-court-c', buildingId: 'iai-b-adm', floorId: 'iai-b-adm-0', label: 'Cour centrale', x: 0, y: 8 },
  { id: 'n-court-e', buildingId: 'iai-b-cet', floorId: 'iai-b-cet-0', label: 'Cour — côté est', x: 18, y: -6 },

  // Administratif ground floor
  { id: 'n-adm0-entrance', buildingId: 'iai-b-adm', floorId: 'iai-b-adm-0', label: 'Entrée Administration', x: 20, y: 26 },
  { id: 'n-adm0-hall', buildingId: 'iai-b-adm', floorId: 'iai-b-adm-0', label: 'Hall ADM', x: 24, y: 30 },
  { id: 'n-adm0-c1', buildingId: 'iai-b-adm', floorId: 'iai-b-adm-0', label: 'Couloir ADM rez', x: 28, y: 34 },
  { id: 'n-adm0-s01', buildingId: 'iai-b-adm', floorId: 'iai-b-adm-0', label: 'Scolarité', x: 22, y: 36 },
  { id: 'n-adm0-s02', buildingId: 'iai-b-adm', floorId: 'iai-b-adm-0', label: 'Bureau des Stages', x: 32, y: 38 },
  { id: 'n-adm0-s03', buildingId: 'iai-b-adm', floorId: 'iai-b-adm-0', label: 'Salle d’Entretien 1', x: 33, y: 31 },
  { id: 'n-adm0-stairs', buildingId: 'iai-b-adm', floorId: 'iai-b-adm-0', label: 'Escalier ADM rez', x: 27, y: 30 },
  { id: 'n-adm0-lift', buildingId: 'iai-b-adm', floorId: 'iai-b-adm-0', label: 'Ascenseur ADM rez', x: 25, y: 33 },
  // Administratif first floor
  { id: 'n-adm1-stairs', buildingId: 'iai-b-adm', floorId: 'iai-b-adm-1', label: 'Escalier ADM 1er', x: 27, y: 30 },
  { id: 'n-adm1-lift', buildingId: 'iai-b-adm', floorId: 'iai-b-adm-1', label: 'Ascenseur ADM 1er', x: 25, y: 33 },
  { id: 'n-adm1-c1', buildingId: 'iai-b-adm', floorId: 'iai-b-adm-1', label: 'Couloir ADM 1er', x: 28, y: 33 },
  { id: 'n-adm1-d11', buildingId: 'iai-b-adm', floorId: 'iai-b-adm-1', label: 'Salle du Conseil', x: 33, y: 36 },
  { id: 'n-adm1-d12', buildingId: 'iai-b-adm', floorId: 'iai-b-adm-1', label: 'Salle d’Entretien 2', x: 22, y: 35 },

  // Centre d'Excellence
  { id: 'n-cet0-entrance', buildingId: 'iai-b-cet', floorId: 'iai-b-cet-0', label: 'Entrée CET', x: 32, y: -22 },
  { id: 'n-cet0-hall', buildingId: 'iai-b-cet', floorId: 'iai-b-cet-0', label: 'Hall CET', x: 36, y: -26 },
  { id: 'n-cet0-l01', buildingId: 'iai-b-cet', floorId: 'iai-b-cet-0', label: 'Laboratoire Logiciel', x: 44, y: -24 },
  { id: 'n-cet0-l02', buildingId: 'iai-b-cet', floorId: 'iai-b-cet-0', label: 'Laboratoire Systèmes', x: 44, y: -32 },
  { id: 'n-cet0-bib', buildingId: 'iai-b-cet', floorId: 'iai-b-cet-0', label: 'Bibliothèque', x: 34, y: -34 },
];

export const NAV_NODES: NavNode[] = NODE_SEEDS.map((seed) => ({ ...seed, coordinates: at(seed.x, seed.y) }));

const EDGE_SEEDS: [string, string, NavEdge['kind'], boolean][] = [
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

  ['n-ped0-entrance', 'n-court-w', 'CORRIDOR', true],
  ['n-court-w', 'n-court-c', 'CORRIDOR', true],
  ['n-court-c', 'n-court-e', 'CORRIDOR', true],
  ['n-court-c', 'n-adm0-entrance', 'CORRIDOR', true],
  ['n-court-e', 'n-cet0-entrance', 'CORRIDOR', true],

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

  ['n-cet0-entrance', 'n-cet0-hall', 'DOOR', true],
  ['n-cet0-hall', 'n-cet0-l01', 'DOOR', true],
  ['n-cet0-hall', 'n-cet0-l02', 'DOOR', true],
  ['n-cet0-hall', 'n-cet0-bib', 'DOOR', true],
];

export const NAV_EDGES: NavEdge[] = EDGE_SEEDS.map(([from, to, kind, accessible]) => ({ from, to, kind, accessible }));

/** Printed anchors. The code is what the student's camera reads. */
export const QR_ANCHORS: QrAnchor[] = [
  { code: 'IAI-PED-ENT', buildingId: 'iai-b-ped', floorId: 'iai-b-ped-0', nodeId: 'n-ped0-entrance', label: 'Entrée du Bâtiment Pédagogique' },
  { code: 'IAI-PED-HALL', buildingId: 'iai-b-ped', floorId: 'iai-b-ped-0', nodeId: 'n-ped0-hall', label: 'Hall du Bâtiment Pédagogique' },
  { code: 'IAI-PED-1ET', buildingId: 'iai-b-ped', floorId: 'iai-b-ped-1', nodeId: 'n-ped1-c1', label: 'Couloir du 1er étage — Pédagogique' },
  { code: 'IAI-ADM-ENT', buildingId: 'iai-b-adm', floorId: 'iai-b-adm-0', nodeId: 'n-adm0-entrance', label: 'Entrée du Bloc Administratif' },
  { code: 'IAI-ADM-HALL', buildingId: 'iai-b-adm', floorId: 'iai-b-adm-0', nodeId: 'n-adm0-hall', label: 'Hall du Bloc Administratif' },
  { code: 'IAI-ADM-1ET', buildingId: 'iai-b-adm', floorId: 'iai-b-adm-1', nodeId: 'n-adm1-c1', label: 'Couloir du 1er étage — Administration' },
  { code: 'IAI-CET-ENT', buildingId: 'iai-b-cet', floorId: 'iai-b-cet-0', nodeId: 'n-cet0-entrance', label: 'Entrée du Centre d’Excellence' },
  { code: 'IAI-COUR', buildingId: 'iai-b-adm', floorId: 'iai-b-adm-0', nodeId: 'n-court-c', label: 'Cour centrale' },
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

export function floorName(buildingId: string, floorId: string): string {
  return buildingById(buildingId)?.floors.find((floor) => floor.id === floorId)?.name ?? 'Niveau inconnu';
}
