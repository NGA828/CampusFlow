'use client';

import { useEffect, useRef } from 'react';
import maplibregl, { type Map as MapLibreMap, type Marker } from 'maplibre-gl';
import type { CampusModel, IndoorRoute } from '@/lib/types';

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const ROUTE_SOURCE = 'campusflow-route';
const CAMPUS_SOURCE = 'campusflow-campus';

/** One glyph per landmark kind — a gate and a fountain should not look alike. */
const LANDMARK_GLYPH: Record<string, string> = {
  GATE: '⛩',
  PLAZA: '▣',
  FOUNTAIN: '⛲',
  MONUMENT: '🗿',
  PARKING: 'P',
  GARDEN: '❦',
  VIEWPOINT: '◭',
  SPORT: '⚽',
};

/**
 * The IAI campus map.
 *
 * Three layers of ground truth, drawn so they can be told apart: the surveyed
 * perimeter from OpenStreetMap, the building footprints, and the landmarks a student
 * actually navigates by — the gate, the flagpoles, the fountain, the esplanade.
 *
 * The computed route is a line through the real graph nodes — the same ones the API
 * routed over — so what is drawn is what was computed, never a smoothed decoration
 * on top of it.
 */
export function CampusMap({
  campus,
  route,
  positionNodeId,
}: {
  campus: CampusModel;
  route: IndoorRoute | null;
  positionNodeId: string | null;
}) {
  const container = useRef<HTMLDivElement | null>(null);
  const map = useRef<MapLibreMap | null>(null);
  const ready = useRef(false);
  const markers = useRef<Marker[]>([]);

  useEffect(() => {
    if (!container.current || map.current) return;
    const instance = new maplibregl.Map({
      container: container.current,
      style: STYLE_URL,
      center: campus.university.coordinates,
      zoom: 17.2,
      attributionControl: { compact: true },
    });
    map.current = instance;
    instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    instance.on('load', () => {
      ready.current = true;

      instance.addSource(CAMPUS_SOURCE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      instance.addLayer({
        id: `${CAMPUS_SOURCE}-perimeter-fill`,
        type: 'fill',
        source: CAMPUS_SOURCE,
        filter: ['==', ['get', 'role'], 'perimeter'],
        paint: { 'fill-color': '#2a4bd8', 'fill-opacity': 0.07 },
      });
      instance.addLayer({
        id: `${CAMPUS_SOURCE}-perimeter-line`,
        type: 'line',
        source: CAMPUS_SOURCE,
        filter: ['==', ['get', 'role'], 'perimeter'],
        paint: { 'line-color': '#2a4bd8', 'line-width': 2, 'line-dasharray': [3, 2], 'line-opacity': 0.8 },
      });
      instance.addLayer({
        id: `${CAMPUS_SOURCE}-building-fill`,
        type: 'fill',
        source: CAMPUS_SOURCE,
        filter: ['==', ['get', 'role'], 'building'],
        paint: { 'fill-color': '#0b1020', 'fill-opacity': 0.5 },
      });
      instance.addLayer({
        id: `${CAMPUS_SOURCE}-building-line`,
        type: 'line',
        source: CAMPUS_SOURCE,
        filter: ['==', ['get', 'role'], 'building'],
        paint: { 'line-color': '#0b1020', 'line-width': 1.5 },
      });

      instance.addSource(ROUTE_SOURCE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      instance.addLayer({
        id: `${ROUTE_SOURCE}-line`,
        type: 'line',
        source: ROUTE_SOURCE,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#2a4bd8', 'line-width': 5, 'line-opacity': 0.85 },
      });
    });
    return () => {
      instance.remove();
      map.current = null;
      ready.current = false;
    };
  }, [campus.university.coordinates]);

  // The perimeter and the building footprints.
  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const draw = () => {
      const source = instance.getSource(CAMPUS_SOURCE) as maplibregl.GeoJSONSource | undefined;
      if (!source) return;
      const features: GeoJSON.Feature[] = [];
      if (campus.boundary) {
        features.push({
          type: 'Feature',
          properties: { role: 'perimeter' },
          geometry: { type: 'Polygon', coordinates: [campus.boundary.ring] },
        });
      }
      for (const building of campus.buildings) {
        if (!building.footprint) continue;
        features.push({
          type: 'Feature',
          properties: { role: 'building', code: building.code },
          geometry: { type: 'Polygon', coordinates: [building.footprint] },
        });
      }
      source.setData({ type: 'FeatureCollection', features });
    };
    if (ready.current) draw();
    else instance.once('load', draw);
  }, [campus]);

  // Buildings, landmarks and the current position.
  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    for (const marker of markers.current) marker.remove();

    markers.current = campus.buildings.map((building) => {
      const element = document.createElement('div');
      element.className = 'marker';
      element.textContent = building.code;
      element.style.width = '38px';
      element.style.borderRadius = '10px';
      return new maplibregl.Marker({ element })
        .setLngLat(building.coordinates)
        .setPopup(new maplibregl.Popup({ offset: 16 }).setText(`${building.name} — ${building.description}`))
        .addTo(instance);
    });

    for (const landmark of campus.landmarks) {
      const element = document.createElement('div');
      element.className = 'marker markerLandmark';
      element.textContent = LANDMARK_GLYPH[landmark.kind] ?? '•';
      element.title = landmark.name;
      markers.current.push(
        new maplibregl.Marker({ element })
          .setLngLat(landmark.coordinates)
          .setPopup(new maplibregl.Popup({ offset: 14 }).setText(`${landmark.name} — ${landmark.description}`))
          .addTo(instance),
      );
    }

    const node = positionNodeId ? campus.nodes.find((item) => item.id === positionNodeId) : null;
    if (node) {
      const element = document.createElement('div');
      element.className = 'marker markerPriority';
      element.textContent = '•';
      element.setAttribute('aria-label', `You are here: ${node.label}`);
      markers.current.push(
        new maplibregl.Marker({ element })
          .setLngLat(node.coordinates)
          .setPopup(new maplibregl.Popup({ offset: 16 }).setText(`You are here — ${node.label}`))
          .addTo(instance),
      );
      instance.flyTo({ center: node.coordinates, zoom: 18, speed: 0.8 });
    }
  }, [campus, positionNodeId]);

  // The computed route.
  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const draw = () => {
      const source = instance.getSource(ROUTE_SOURCE) as maplibregl.GeoJSONSource | undefined;
      if (!source) return;
      if (!route || route.steps.length < 2) {
        source.setData({ type: 'FeatureCollection', features: [] });
        return;
      }
      const coordinates = route.steps.map((step) => step.coordinates);
      source.setData({
        type: 'FeatureCollection',
        features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } }],
      });
      const bounds = coordinates.reduce(
        (box, point) => box.extend(point),
        new maplibregl.LngLatBounds(coordinates[0], coordinates[0]),
      );
      instance.fitBounds(bounds, { padding: 70, maxZoom: 19, duration: 700 });
    };
    if (ready.current) draw();
    else instance.once('load', draw);
  }, [route]);

  return <div ref={container} className="map mapTall" role="application" aria-label={`Campus map of ${campus.university.shortName}`} />;
}
