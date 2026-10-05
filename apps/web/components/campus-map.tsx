'use client';

import { useEffect, useRef } from 'react';
import maplibregl, { type Map as MapLibreMap, type Marker } from 'maplibre-gl';
import type { CampusModel, IndoorRoute } from '@/lib/types';

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const ROUTE_SOURCE = 'campusflow-route';

/**
 * The IAI campus map.
 *
 * Buildings are markers, the computed indoor route is a line, and the student's fixed
 * position (from a scanned QR anchor) is its own marker. The route is drawn through the
 * real graph nodes — the same ones the API routed over — so what is drawn is what was
 * computed, never a smoothed decoration on top of it.
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

  // Buildings and the current position.
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
