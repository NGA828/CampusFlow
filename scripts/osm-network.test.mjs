/**
 * Tests for the OSM → walking graph conversion.
 *
 * The fixture is real: these are verbatim Overpass `out geom` results for ways on the Université
 * de Yaoundé I campus (Rue 3.421 and its roundabout, Rue 3.397, a service road). Using invented
 * geometry here would defeat the point — the awkward cases this code has to survive, such as a
 * roundabout that starts and ends on the same node, only show up in real data.
 *
 *   node --test scripts/osm-network.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWalkingGraph,
  edgeAccessible,
  haversineMetres,
  isWalkable,
  polylineMetres,
} from './osm-network.mjs';

/** Rue 3.421 — approaches the roundabout; shares node 7545608284 with the ring below. */
const RUE_3421_APPROACH = {
  type: 'way',
  id: 207574374,
  nodes: [7545608284, 3270486531, 3270486530, 7545658470, 2178342970, 3270486528, 2178343070, 2178343007, 7545577378, 2178342841, 1987066033],
  geometry: [
    { lat: 3.8581125, lon: 11.4989631 }, { lat: 3.8580430, lon: 11.4989855 },
    { lat: 3.8580022, lon: 11.4989964 }, { lat: 3.8579764, lon: 11.4990038 },
    { lat: 3.8579222, lon: 11.4990260 }, { lat: 3.8578544, lon: 11.4991694 },
    { lat: 3.8577871, lon: 11.4993593 }, { lat: 3.8577416, lon: 11.4995363 },
    { lat: 3.8577557, lon: 11.4996533 }, { lat: 3.8578065, lon: 11.4997864 },
    { lat: 3.8578775, lon: 11.4999730 },
  ],
  tags: { highway: 'residential', name: 'Rue 3.421', oneway: 'yes', surface: 'asphalt', junction: 'roundabout' },
};

/** The roundabout ring itself — a closed way: first and last node are both 7545608284. */
const ROUNDABOUT = {
  type: 'way',
  id: 207574383,
  nodes: [7545608284, 2178342912, 2178342810, 2178342880, 7545608284],
  geometry: [
    { lat: 3.8581125, lon: 11.4989631 }, { lat: 3.8581414, lon: 11.4990061 },
    { lat: 3.8581812, lon: 11.4990390 }, { lat: 3.8582289, lon: 11.4990592 },
    { lat: 3.8581125, lon: 11.4989631 },
  ],
  tags: { highway: 'residential', name: 'Rue 3.421', oneway: 'yes', junction: 'roundabout' },
};

const SERVICE_ROAD = {
  type: 'way',
  id: 207574384,
  nodes: [2178342946, 2991185305, 2178342850],
  geometry: [
    { lat: 3.8579852, lon: 11.4999121 }, { lat: 3.8579255, lon: 11.4997792 },
    { lat: 3.8578861, lon: 11.4996355 },
  ],
  tags: { highway: 'service', surface: 'asphalt' },
};

const STAIRS = {
  type: 'way',
  id: 999000001,
  nodes: [2178342850, 900000002],
  geometry: [{ lat: 3.8578861, lon: 11.4996355 }, { lat: 3.8578500, lon: 11.4996000 }],
  tags: { highway: 'steps' },
};

const MOTORWAY = {
  type: 'way',
  id: 999000002,
  nodes: [900000003, 900000004],
  geometry: [{ lat: 3.8570000, lon: 11.4990000 }, { lat: 3.8571000, lon: 11.4991000 }],
  tags: { highway: 'motorway' },
};

test('haversine matches a known short campus distance', () => {
  // Two surveyed points ~110 m apart on Rue 3.421.
  const d = haversineMetres(3.8581125, 11.4989631, 3.8578775, 11.4999730);
  assert.ok(d > 100 && d < 130, `expected ~115 m, got ${d}`);
});

test('polyline length is the sum of its segments, not the straight line', () => {
  const direct = haversineMetres(
    RUE_3421_APPROACH.geometry[0].lat, RUE_3421_APPROACH.geometry[0].lon,
    RUE_3421_APPROACH.geometry.at(-1).lat, RUE_3421_APPROACH.geometry.at(-1).lon,
  );
  const along = polylineMetres(RUE_3421_APPROACH.geometry);
  assert.ok(along > direct, 'a curved street must be longer than its chord');
});

test('walkability excludes motorways and includes steps', () => {
  assert.equal(isWalkable({ highway: 'motorway' }), false);
  assert.equal(isWalkable({ highway: 'steps' }), true);
  assert.equal(isWalkable({ highway: 'footway' }), true);
  assert.equal(isWalkable({}), false);
});

test('steps are never step-free, and a surveyed wheelchair=no overrides the default', () => {
  assert.equal(edgeAccessible({ highway: 'steps' }), false);
  assert.equal(edgeAccessible({ highway: 'steps', wheelchair: 'yes' }), false);
  assert.equal(edgeAccessible({ highway: 'footway' }), true);
  assert.equal(edgeAccessible({ highway: 'footway', wheelchair: 'no' }), false);
  assert.equal(edgeAccessible({ highway: 'track' }), false);
});

test('a way is split at the junction it shares with another way', () => {
  const { nodes, edges } = buildWalkingGraph([RUE_3421_APPROACH, ROUNDABOUT, SERVICE_ROAD]);

  // 7545608284 is shared by the approach and the ring, so it must become a vertex.
  assert.ok(nodes.some((n) => n.osm_id === 7545608284), 'the shared junction must be a vertex');

  // Intermediate shape points must NOT become vertices.
  assert.equal(nodes.some((n) => n.osm_id === 3270486530), false, 'shape points are not junctions');

  // Every edge keeps its real geometry rather than a two-point chord.
  const approach = edges.find((e) => e.way_osm_id === 207574374);
  assert.ok(approach.geometry.length > 2, 'the edge must carry the intermediate shape');
  assert.deepEqual(approach.geometry[0], [11.4989631, 3.8581125], 'geometry is [lng, lat]');
});

test('a closed ring does not produce a zero-length self-edge', () => {
  const { edges } = buildWalkingGraph([ROUNDABOUT]);
  for (const edge of edges) {
    assert.notEqual(edge.from_osm_id, edge.to_osm_id, 'no edge may start and end on one node');
    assert.ok(edge.weight > 0, 'no zero-weight edge');
  }
});

test('pedestrian edges stay bidirectional even on a oneway street', () => {
  const { edges } = buildWalkingGraph([RUE_3421_APPROACH]);
  assert.ok(edges.length > 0);
  assert.ok(edges.every((e) => e.bidirectional), 'oneway applies to vehicles, not to people walking');
});

test('unroutable ways are skipped and counted, not silently dropped', () => {
  const { edges, skipped } = buildWalkingGraph([SERVICE_ROAD, MOTORWAY]);
  assert.equal(skipped, 1);
  assert.ok(edges.every((e) => e.way_osm_id !== 999000002), 'no motorway edges');
});

test('steps become a stairwell edge, which is what the accessible filter keys off', () => {
  const { edges } = buildWalkingGraph([SERVICE_ROAD, STAIRS]);
  const stairs = edges.find((e) => e.way_osm_id === 999000001);
  assert.equal(stairs.edge_type, 'stairwell');
  assert.equal(stairs.accessible, false);
});

test('the service road connects to the stairs through their shared node', () => {
  const { nodes } = buildWalkingGraph([SERVICE_ROAD, STAIRS]);
  assert.ok(nodes.some((n) => n.osm_id === 2178342850), 'the shared node joins the two ways');
});
