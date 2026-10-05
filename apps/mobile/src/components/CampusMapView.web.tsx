import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Text, View } from 'react-native';
import { colours, styles } from '../theme';
import { LANDMARK_GLYPH, STYLE_URL, type CampusMapProps } from './map-types';

/**
 * Web campus map — the same MapLibre style and the same data as the native map,
 * rendered with MapLibre GL JS so the app can be reviewed in a browser without a
 * native build. Markers and the route line are reconciled on every prop change
 * rather than rebuilt with the map, which keeps panning stable while routing.
 */
export function CampusMapView({ centre, zoom, boundary, buildings, landmarks, gps, indoor, route, plan }: CampusMapProps) {
  const container = useRef<HTMLDivElement | null>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const ready = useRef(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!container.current || map.current) return;

    // WebGL is not available everywhere — a locked-down browser or a software
    // renderer throws here, and that must degrade to a message, not a blank app.
    let instance: maplibregl.Map;
    try {
      instance = new maplibregl.Map({
        container: container.current,
        style: STYLE_URL,
        center: centre,
        zoom,
        attributionControl: { compact: true },
      });
    } catch {
      setFailed(true);
      return;
    }
    instance.on('error', (event) => {
      if (String(event?.error?.message ?? '').includes('WebGL')) setFailed(true);
    });
    instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    instance.on('load', () => {
      ready.current = true;

      // The surveyed perimeter and the building footprints sit under everything else.
      instance.addSource('campus', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      instance.addLayer({
        id: 'campus-perimeter-fill',
        type: 'fill',
        source: 'campus',
        filter: ['==', ['get', 'role'], 'perimeter'],
        paint: { 'fill-color': colours.brand, 'fill-opacity': 0.07 },
      });
      instance.addLayer({
        id: 'campus-perimeter-line',
        type: 'line',
        source: 'campus',
        filter: ['==', ['get', 'role'], 'perimeter'],
        paint: { 'line-color': colours.brand, 'line-width': 2, 'line-dasharray': [3, 2], 'line-opacity': 0.8 },
      });
      instance.addLayer({
        id: 'campus-building-fill',
        type: 'fill',
        source: 'campus',
        filter: ['==', ['get', 'role'], 'building'],
        paint: { 'fill-color': colours.ink, 'fill-opacity': 0.5 },
      });
      instance.addLayer({
        id: 'campus-building-line',
        type: 'line',
        source: 'campus',
        filter: ['==', ['get', 'role'], 'building'],
        paint: { 'line-color': colours.ink, 'line-width': 1.5 },
      });

      // The indoor plan, drawn over the footprints: rooms, then their corridor.
      instance.addLayer({
        id: 'campus-room-fill',
        type: 'fill',
        source: 'campus',
        filter: ['==', ['get', 'role'], 'room'],
        paint: {
          'fill-color': ['case', ['get', 'bookable'], colours.brand, '#f4f6ff'],
          'fill-opacity': ['case', ['get', 'bookable'], 0.55, 0.9],
        },
      });
      instance.addLayer({
        id: 'campus-room-line',
        type: 'line',
        source: 'campus',
        filter: ['==', ['get', 'role'], 'room'],
        paint: { 'line-color': colours.ink, 'line-width': 1 },
      });
      instance.addLayer({
        id: 'campus-corridor-line',
        type: 'line',
        source: 'campus',
        filter: ['==', ['get', 'role'], 'corridor'],
        layout: { 'line-cap': 'round' },
        paint: { 'line-color': '#9aa6c8', 'line-width': 6, 'line-opacity': 0.7 },
      });

      instance.addSource('route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      instance.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': colours.brand, 'line-width': 5 },
      });
    });
    map.current = instance;
    return () => {
      instance.remove();
      map.current = null;
      ready.current = false;
    };
    // The map is created once; every later change is applied by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    map.current?.easeTo({ center: centre, zoom, duration: 700 });
  }, [centre[0], centre[1], zoom]);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const draw = () => {
      const source = instance.getSource('campus') as maplibregl.GeoJSONSource | undefined;
      if (!source) return;
      const features = [];
      if (boundary) {
        features.push({
          type: 'Feature' as const,
          properties: { role: 'perimeter' },
          geometry: { type: 'Polygon' as const, coordinates: [boundary] },
        });
      }
      for (const building of buildings) {
        if (!building.footprint) continue;
        features.push({
          type: 'Feature' as const,
          properties: { role: 'building', code: building.code },
          geometry: { type: 'Polygon' as const, coordinates: [building.footprint] },
        });
      }
      for (const corridor of plan?.corridors ?? []) {
        features.push({
          type: 'Feature' as const,
          properties: { role: 'corridor' },
          geometry: { type: 'LineString' as const, coordinates: corridor },
        });
      }
      for (const room of plan?.rooms ?? []) {
        features.push({
          type: 'Feature' as const,
          properties: { role: 'room', code: room.code, bookable: room.bookable },
          geometry: { type: 'Polygon' as const, coordinates: [room.polygon] },
        });
      }
      source.setData({ type: 'FeatureCollection', features });
    };
    if (ready.current) draw();
    else instance.once('load', draw);
  }, [boundary, buildings, plan]);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;

    for (const marker of markers.current) marker.remove();
    markers.current = [];

    const add = (coordinates: [number, number], element: HTMLElement) => {
      markers.current.push(new maplibregl.Marker({ element }).setLngLat(coordinates).addTo(instance));
    };

    for (const building of buildings) {
      const label = document.createElement('div');
      label.textContent = building.code;
      label.title = building.name;
      label.style.cssText = `background:${colours.ink};color:white;font:800 11px/1 system-ui;padding:4px 7px;border-radius:8px`;
      add(building.coordinates, label);
    }

    for (const landmark of landmarks) {
      const glyph = document.createElement('div');
      glyph.textContent = LANDMARK_GLYPH[landmark.kind] ?? '•';
      glyph.title = landmark.name;
      glyph.style.cssText =
        'display:grid;place-items:center;width:22px;height:22px;border-radius:50%;background:white;border:1px solid #cfd6ec;font:12px/1 system-ui';
      add(landmark.coordinates, glyph);
    }

    const dot = (colour: string, size: number) => {
      const element = document.createElement('div');
      element.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;background:${colour};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4)`;
      return element;
    };

    for (const room of plan?.rooms ?? []) {
      const number = document.createElement('div');
      number.textContent = room.code;
      number.title = room.name;
      number.style.cssText =
        'font:700 10px/1 system-ui;color:#0b1020;background:rgba(255,255,255,.85);padding:2px 4px;border-radius:5px';
      add(room.centre, number);
    }

    if (gps) add(gps, dot(colours.brand, 16));
    if (indoor) add(indoor, dot(colours.gold, 18));
  }, [buildings, landmarks, plan, gps?.[0], gps?.[1], indoor?.[0], indoor?.[1]]);

  useEffect(() => {
    const instance = map.current;
    if (!instance || !ready.current) return;
    const source = instance.getSource('route') as maplibregl.GeoJSONSource | undefined;
    if (!source) return;
    source.setData(
      route && route.length > 1
        ? { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: route } }
        : { type: 'FeatureCollection', features: [] },
    );
    if (route && route.length > 1) {
      const bounds = route.reduce(
        (box, point) => box.extend(point),
        new maplibregl.LngLatBounds(route[0], route[0]),
      );
      instance.fitBounds(bounds, { padding: 60, maxZoom: 19, duration: 700 });
    }
  }, [route]);

  if (failed) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <Text style={styles.cardTitle}>Carte indisponible</Text>
        <Text style={[styles.muted, { textAlign: 'center' }]}>
          Ce navigateur ne peut pas afficher la carte (WebGL indisponible). Les itinéraires et les instructions
          ci-dessous restent utilisables.
        </Text>
      </View>
    );
  }

  return <div ref={container} style={{ position: 'absolute', inset: 0 }} />;
}
