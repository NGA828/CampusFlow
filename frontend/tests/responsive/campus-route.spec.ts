import { expect, test } from '@playwright/test';
import { operationsSession } from './campus-operations-fixtures';
import { routeSegments, stepNode } from '../../lib/maps/route-geometry';
import type { Route } from '../../lib/api/types';

const nodes = [
  { id: 'n0', label: 'Gate', floor_id: null, lat: 3.863, lng: 11.512, plan_x: null, plan_y: null },
  { id: 'n1', label: 'Entrance', floor_id: 'f1', lat: 3.864, lng: 11.512, plan_x: 2, plan_y: 5 },
  { id: 'n2', label: 'Corridor bend', floor_id: 'f1', lat: null, lng: null, plan_x: 18, plan_y: 5 },
  { id: 'n3', label: 'Lift', floor_id: 'f1', lat: null, lng: null, plan_x: 18, plan_y: 20 },
  { id: 'n4', label: 'First-floor lift', floor_id: 'f2', lat: null, lng: null, plan_x: 3, plan_y: 4 },
  { id: 'n5', label: 'Seminar room', floor_id: 'f2', lat: null, lng: null, plan_x: 24, plan_y: 4 },
].map(n => ({ ...n, code: n.id, kind: 'junction' as const, type: 'waypoint', building_id: n.floor_id ? 'b1' : null, room_id: null, qr_node_id: null, is_active: true, is_accessible: true }));
const route: Route = {
  nodes, distance_m: 150, duration_s: 125, accessible: false, uses_stairs: false,
  edges: [
    { id: 'e01', from_node_id: 'n0', to_node_id: 'n1', kind: 'outdoor', geometry_space: 'geo', geometry: [[11.512, 3.8635]], distance_m: 20 },
    { id: 'e12', from_node_id: 'n1', to_node_id: 'n2', kind: 'corridor', geometry_space: 'plan', geometry: [[10, 5]], distance_m: 16 },
    { id: 'e23', from_node_id: 'n2', to_node_id: 'n3', kind: 'corridor', geometry_space: null, geometry: null, distance_m: 15 },
    { id: 'e34', from_node_id: 'n3', to_node_id: 'n4', kind: 'stairs', geometry_space: null, geometry: null, distance_m: 20 },
    { id: 'e45', from_node_id: 'n4', to_node_id: 'n5', kind: 'corridor', geometry_space: 'plan', geometry: [[12, 4]], distance_m: 21 },
  ],
  origin: { label: 'Gate', node: nodes[0] }, destination: { label: 'Seminar room', node: nodes[5] },
  legs: [], transitions: [],
  steps: [...nodes.map((n, index) => ({ index, node_id: n.id, instruction: index ? `Head to ${n.label}` : 'Start at Gate', kind: index ? 'walk' : 'start', distance_m: index ? 30 : 0, duration_s: index ? 25 : 0, floor_id: n.floor_id, floor_name: n.floor_id === 'f2' ? 'First floor' : n.floor_id ? 'Ground floor' : null })),
    { index: 6, node_id: 'n5', instruction: 'Arrive at Seminar room', kind: 'arrive', distance_m: 0, duration_s: 0, floor_id: 'f2', floor_name: 'First floor' }],
};

test('geometry connects only adjacent nodes on the same floor and never bridges missing coordinates', () => {
  expect(routeSegments(route, 'f1')).toEqual([
    { from: { x: 2, y: 5 }, to: { x: 18, y: 5 }, points: [{ x: 2, y: 5 }, { x: 10, y: 5 }, { x: 18, y: 5 }], hasSavedGeometry: true },
    { from: { x: 18, y: 5 }, to: { x: 18, y: 20 }, points: [{ x: 18, y: 5 }, { x: 18, y: 20 }], hasSavedGeometry: false },
  ]);
  expect(routeSegments(route, null)).toEqual([{
    from: { x: 11.512, y: 3.863 }, to: { x: 11.512, y: 3.864 },
    points: [{ x: 11.512, y: 3.863 }, { x: 11.512, y: 3.8635 }, { x: 11.512, y: 3.864 }],
    hasSavedGeometry: true,
  }]);
  const missing = { ...route, nodes: nodes.map(n => n.id === 'n2' ? { ...n, plan_x: null } : n) };
  expect(routeSegments(missing, 'f1')).toHaveLength(0);
  expect(stepNode(route, route.steps[3], 3)?.id).toBe('n3');
  expect(stepNode({ ...route, steps: route.steps.slice(1) }, { ...route.steps[3], node_id: undefined }, 3)).toBeNull();
});

for (const width of [390, 1280]) test(`visual route follows steps and changes floors at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.routeWebSocket('**/api/ws', () => {});
  await operationsSession(page);
  await page.route('**/api/v1/campus/navigation/route', r => r.fulfill({ json: { success: true, data: { route } } }));
  await page.route('**/api/v1/campus/floors/*/plan', r => {
    const id = r.request().url().includes('/f2/') ? 'f2' : 'f1';
    return r.fulfill({ json: { success: true, data: { floor: { id, building_id: 'b1', name: id === 'f2' ? 'First floor' : 'Ground floor', level: id === 'f2' ? 1 : 0, plan_width: 40, plan_height: 30 }, building: { id: 'b1', name: 'Learning centre' }, rooms: [], navigation_nodes: nodes.filter(n => n.floor_id === id), navigation_edges: [], qr_nodes: [], busy: {} } } });
  });
  await page.goto('/student/campus/map?route=A101');
  await page.getByLabel('Starting anchor').selectOption('node1');
  await page.getByRole('button', { name: 'Preview route', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Visual route preview' })).toBeVisible();
  await expect(page.getByTestId('outdoor-route')).toHaveAttribute('d', /M.+L/);
  await page.getByRole('button', { name: /Head to Corridor bend/ }).click();
  await expect(page.getByTestId('route-position')).toHaveAttribute('transform', 'translate(18, 5)');
  await expect(page.getByTestId('indoor-route')).toHaveCount(2);
  await page.getByRole('button', { name: /Head to Lift/ }).click();
  await expect(page.getByTestId('route-position')).toHaveAttribute('transform', 'translate(18, 20)');
  await page.getByRole('button', { name: /Head to First-floor lift/ }).click();
  await expect(page.getByLabel('Route map view')).toHaveValue('f2');
  await expect(page.getByTestId('indoor-route')).toHaveCount(1);
  await expect(page.getByTestId('route-position')).toHaveAttribute('transform', 'translate(3, 4)');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `test-results/campus-route-${width}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Explore Places' }).click();
  await expect(page.getByRole('heading', { name: 'Places on campus' })).toBeVisible();
});

test('outdoor polylines can connect entrance nodes that carry floor metadata', () => {
  const betweenEntrances: Route = {
    ...route,
    nodes: [nodes[1], { ...nodes[4], lat: 3.865, lng: 11.514 }],
    edges: [{
      id: 'outdoor-entrance-link', from_node_id: 'n1', to_node_id: 'n4', kind: 'outdoor',
      geometry_space: 'geo', geometry: [[11.513, 3.8645]], distance_m: 110,
    }],
  };
  expect(routeSegments(betweenEntrances, null)[0].points).toEqual([
    { x: 11.512, y: 3.864 }, { x: 11.513, y: 3.8645 }, { x: 11.514, y: 3.865 },
  ]);
  expect(routeSegments(betweenEntrances, 'f1')).toHaveLength(0);
});

test('empty route responses are not presented as successful guidance', async ({ page }) => {
  await page.routeWebSocket('**/api/ws', () => {});
  await operationsSession(page);
  await page.route('**/api/v1/campus/navigation/route', r => r.fulfill({ json: { success: true, data: { route: { ...route, nodes: [], steps: [] } } } }));
  await page.goto('/student/campus/map?route=A101');
  await page.getByLabel('Starting anchor').selectOption('node1');
  await page.getByRole('button', { name: 'Preview route', exact: true }).click();
  await expect(page.getByText('No walkable route is available for these places.', { exact: false })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Visual route preview' })).toHaveCount(0);
});
