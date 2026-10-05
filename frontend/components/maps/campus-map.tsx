'use client';

/**
 * MapLibre renders OSM building extrusions and the authoritative CampusFlow
 * footprints/routes. Missing campus geometry is never replaced with a guessed shape.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  GeoJSONSource,
  Map as MapLibreMap,
  MapLayerMouseEvent,
  Marker,
  StyleSpecification,
} from 'maplibre-gl';
import { routeSegments, type RouteStartFix } from '@/lib/maps/route-geometry';
import { Button, cx } from '@/components/ui/kit';
import type { Building, Position, Route } from '@/lib/api/types';

export interface MapMarker {
  lat: number;
  lng: number;
  label: string;
  tone?: 'user' | 'destination' | 'qr' | 'office';
}

interface Props {
  buildings: Pick<
    Building,
    'id' | 'code' | 'name' | 'lat' | 'lng' | 'footprint' | 'height_m' | 'status'
  >[];
  route?: Route | null;
  originFix?: RouteStartFix | null;
  markers?: MapMarker[];
  selectedBuildingId?: string | null;
  onSelectBuilding?: (id: string) => void;
  onOpenBuilding?: (id: string) => void;
  height?: number;
  className?: string;
}

type MapStatus = 'loading' | 'ready' | 'fallback' | 'error';
type ProjectedFootprint = { id: string; name: string; points: string; selected: boolean };
type ProjectedRoute = { index: number; points: string; saved: boolean };

const STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    {
      id: 'campus-background',
      type: 'background',
      paint: { 'background-color': '#e9efe9' },
    },
  ],
};

function validCoordinate(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

export function CampusMap({
  buildings,
  route,
  originFix = null,
  markers = [],
  selectedBuildingId,
  onSelectBuilding,
  onOpenBuilding,
  height = 420,
  className,
}: Props) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRefs = useRef<Marker[]>([]);
  const callbacks = useRef({ onSelectBuilding, onOpenBuilding });
  const [status, setStatus] = useState<MapStatus>('loading');
  const [mapMessage, setMapMessage] = useState<string | null>(null);
  const [is3d, setIs3d] = useState(true);
  const [retryKey, setRetryKey] = useState(0);
  const [liveLocation, setLiveLocation] = useState<MapMarker | null>(null);
  const [fallbackFootprints, setFallbackFootprints] = useState<ProjectedFootprint[]>([]);
  const [fallbackRoutes, setFallbackRoutes] = useState<ProjectedRoute[]>([]);
  const [fallbackSize, setFallbackSize] = useState<[number, number]>([1, 1]);

  useEffect(() => {
    callbacks.current = { onSelectBuilding, onOpenBuilding };
  }, [onSelectBuilding, onOpenBuilding]);

  const validBuildings = useMemo(
    () => buildings.filter((building) => validCoordinate(building.lat, building.lng)),
    [buildings],
  );

  const buildingData = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: 'FeatureCollection',
    features: validBuildings.map((building) => {
      const ring = (building.footprint ?? []).filter(([lng, lat]) => validCoordinate(lat, lng));
      const isFootprint = ring.length >= 3;
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (isFootprint && (first[0] !== last[0] || first[1] !== last[1])) ring.push(first);

      return {
        type: 'Feature',
        id: building.id,
        properties: {
          id: building.id,
          code: building.code,
          name: building.name,
          status: building.status,
          height_m: building.height_m,
          selected: building.id === selectedBuildingId,
        },
        geometry: isFootprint
          ? { type: 'Polygon', coordinates: [ring] }
          : { type: 'Point', coordinates: [building.lng, building.lat] },
      };
    }),
  }), [validBuildings, selectedBuildingId]);

  const routeData = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: 'FeatureCollection',
    features: route
      ? routeSegments(route, null)
          .filter((segment) => segment.points.length > 1)
          .map((segment, index) => ({
            type: 'Feature',
            properties: { saved: segment.hasSavedGeometry, index },
            geometry: {
              type: 'LineString',
              coordinates: segment.points.map((point) => [point.x, point.y]),
            },
          }))
      : [],
  }), [route]);

  const visibleMarkers = useMemo(() => {
    const values = [...markers];
    if (originFix && validCoordinate(originFix.lat, originFix.lng)) {
      values.unshift({ lat: originFix.lat, lng: originFix.lng, label: 'Your current location', tone: 'user' });
    } else if (route?.origin?.node && validCoordinate(route.origin.node.lat ?? NaN, route.origin.node.lng ?? NaN)) {
      values.unshift({ lat: route.origin.node.lat!, lng: route.origin.node.lng!, label: route.origin.label, tone: 'user' });
    }
    if (route?.destination?.node && validCoordinate(route.destination.node.lat ?? NaN, route.destination.node.lng ?? NaN)) {
      values.push({ lat: route.destination.node.lat!, lng: route.destination.node.lng!, label: route.destination.label, tone: 'destination' });
    }
    if (liveLocation) values.unshift(liveLocation);
    return values.filter((marker) => validCoordinate(marker.lat, marker.lng));
  }, [markers, originFix, route, liveLocation]);

  useEffect(() => {
    if (!host.current || mapRef.current) return;
    let cancelled = false;
    let fallbackApplied = false;
    let styleLoaded = false;
    let loadTimer: number | undefined;

    const startMap = async () => {
      try {
        const ml = await import('maplibre-gl');
        if (cancelled || !host.current) return;

        const savedLocation = originFix && validCoordinate(originFix.lat, originFix.lng)
          ? [originFix.lng, originFix.lat] as [number, number]
          : markers.find((marker) => marker.tone === 'user' && validCoordinate(marker.lat, marker.lng))
            ? [markers.find((marker) => marker.tone === 'user')!.lng, markers.find((marker) => marker.tone === 'user')!.lat] as [number, number]
            : null;
        const campusPoints = validBuildings.map((building) => [building.lng, building.lat] as [number, number]);
        const routePoint = route?.origin?.node && validCoordinate(route.origin.node.lat ?? NaN, route.origin.node.lng ?? NaN)
          ? [route.origin.node.lng!, route.origin.node.lat!] as [number, number]
          : null;
        const center = savedLocation ?? routePoint ?? campusPoints[0] ?? visibleMarkers.map((marker) => [marker.lng, marker.lat] as [number, number])[0];

        if (!center) {
          setStatus('error');
          setMapMessage('This campus has no mapped coordinates yet. Add building coordinates or a positioned route node.');
          return;
        }

        const map = new ml.Map({
          container: host.current,
          style: STYLE,
          center,
          zoom: savedLocation || routePoint ? 18 : 16,
          pitch: 58,
          bearing: -18,
          attributionControl: {},
        });
        mapRef.current = map;
        map.addControl(new ml.NavigationControl({ visualizePitch: true }), 'top-right');
        map.addControl(new ml.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: true,
          fitBoundsOptions: { maxZoom: 19 },
        }), 'top-right');

        map.on('idle', () => {
          if (cancelled || !styleLoaded || fallbackApplied) return;
          if (loadTimer !== undefined) window.clearTimeout(loadTimer);
        });

        const installCampusLayers = () => {
          if (cancelled) return;
          if (!map.getSource('campus-buildings')) {
            map.addSource('campus-buildings', { type: 'geojson', data: buildingData });
          }
          if (!map.getLayer('campus-building-footprints')) {
            map.addLayer({
              id: 'campus-building-footprints',
              type: 'fill',
              source: 'campus-buildings',
              filter: ['==', ['geometry-type'], 'Polygon'],
              paint: {
                'fill-color': ['case', ['boolean', ['get', 'selected'], false], '#4f46e5', '#6685bf'],
                'fill-opacity': 0.35,
              },
            });
          }
          if (!map.getLayer('campus-building-outline')) {
            map.addLayer({
              id: 'campus-building-outline',
              type: 'line',
              source: 'campus-buildings',
              filter: ['==', ['geometry-type'], 'Polygon'],
              paint: {
                'line-color': ['case', ['boolean', ['get', 'selected'], false], '#3730bb', '#2458b8'],
                'line-width': ['case', ['boolean', ['get', 'selected'], false], 3, 1.5],
                'line-opacity': 0.9,
              },
            });
          }
          if (!map.getLayer('campus-building-points')) {
            map.addLayer({
              id: 'campus-building-points',
              type: 'circle',
              source: 'campus-buildings',
              filter: ['==', ['geometry-type'], 'Point'],
              paint: {
                'circle-radius': ['case', ['boolean', ['get', 'selected'], false], 9, 7],
                'circle-color': ['case', ['boolean', ['get', 'selected'], false], '#4f46e5', '#2458b8'],
                'circle-stroke-color': '#ffffff',
                'circle-stroke-width': 2,
              },
            });
          }
          if (!map.getLayer('campus-building-extrusions')) {
            map.addLayer({
              id: 'campus-building-extrusions',
              type: 'fill-extrusion',
              source: 'campus-buildings',
              filter: ['all', ['==', ['geometry-type'], 'Polygon'], ['>', ['coalesce', ['get', 'height_m'], 0], 0]],
              paint: {
                'fill-extrusion-color': ['case', ['boolean', ['get', 'selected'], false], '#4f46e5', '#8292d8'],
                'fill-extrusion-height': ['get', 'height_m'],
                'fill-extrusion-base': 0,
                'fill-extrusion-opacity': 0.9,
              },
            });
          }
          if (!map.getSource('campus-route')) {
            map.addSource('campus-route', { type: 'geojson', data: routeData });
          }
          if (!map.getLayer('route-casing')) {
            map.addLayer({
              id: 'route-casing',
              type: 'line',
              source: 'campus-route',
              paint: { 'line-color': '#fff', 'line-width': 9, 'line-opacity': 0.9 },
              layout: { 'line-cap': 'round', 'line-join': 'round' },
            });
          }
          if (!map.getLayer('outdoor-route')) {
            map.addLayer({
              id: 'outdoor-route',
              type: 'line',
              source: 'campus-route',
              paint: {
                'line-color': ['case', ['boolean', ['get', 'saved'], false], '#2458b8', '#b7791f'],
                'line-width': 5,
                'line-dasharray': ['case', ['boolean', ['get', 'saved'], false], ['literal', [1, 0]], ['literal', [2, 1.5]]],
              },
              layout: { 'line-cap': 'round', 'line-join': 'round' },
            });
          }
          const selectBuilding = (event: MapLayerMouseEvent) => {
            const id = event.features?.[0]?.properties?.id;
            if (typeof id === 'string') callbacks.current.onSelectBuilding?.(id);
          };
          map.on('click', 'campus-building-outline', selectBuilding);
          map.on('click', 'campus-building-labels', selectBuilding);
          map.on('dblclick', 'campus-building-outline', (event) => {
            const id = event.features?.[0]?.properties?.id;
            if (typeof id === 'string') callbacks.current.onOpenBuilding?.(id);
          });
          map.on('dblclick', 'campus-building-labels', (event) => {
            const id = event.features?.[0]?.properties?.id;
            if (typeof id === 'string') callbacks.current.onOpenBuilding?.(id);
          });

          if (!savedLocation && !routePoint && campusPoints.length > 1) {
            const bounds = campusPoints.reduce(
              (box, point) => box.extend(point),
              new ml.LngLatBounds(campusPoints[0], campusPoints[0]),
            );
            map.fitBounds(bounds, { padding: 55, maxZoom: 17, pitch: 58 });
          }

          styleLoaded = true;
          if (fallbackApplied) {
            if (loadTimer !== undefined) window.clearTimeout(loadTimer);
            setStatus('fallback');
            setMapMessage(null);
          } else {
            setStatus('ready');
          }
        };

        const applyLocalFallback = () => {
          if (cancelled) return;
          if (fallbackApplied) {
            setStatus('error');
            setMapMessage('The map renderer could not initialize. Check WebGL support and try again.');
            return;
          }
          fallbackApplied = true;
          setStatus('loading');
          setMapMessage('The live basemap is unavailable. Loading saved CampusFlow geometry instead.');
          map.setStyle(FALLBACK_STYLE);
          if (loadTimer !== undefined) window.clearTimeout(loadTimer);
          loadTimer = window.setTimeout(applyLocalFallback, 8_000);
        };

        map.on('style.load', installCampusLayers);
        map.on('error', () => {
          if (cancelled) return;
          if (!styleLoaded && !fallbackApplied) {
            applyLocalFallback();
          } else if (styleLoaded && !fallbackApplied) {
            setMapMessage('Some live map tiles are unavailable. CampusFlow routes and saved building data remain visible.');
          }
        });
        loadTimer = window.setTimeout(applyLocalFallback, 8_000);
      } catch {
        if (!cancelled) {
          setStatus('error');
          setMapMessage('The map could not be started. Check WebGL support and try again.');
        }
      }
    };

    setStatus('loading');
    setMapMessage(null);
    void startMap();

    return () => {
      cancelled = true;
      if (loadTimer !== undefined) window.clearTimeout(loadTimer);
      markerRefs.current.forEach((marker) => marker.remove());
      markerRefs.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
  // Geometry updates are applied to the existing MapLibre sources below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validBuildings.length, retryKey]);

  useEffect(() => {
    const source = mapRef.current?.getSource('campus-buildings') as GeoJSONSource | undefined;
    source?.setData(buildingData);
  }, [buildingData, status]);

  useEffect(() => {
    const source = mapRef.current?.getSource('campus-route') as GeoJSONSource | undefined;
    source?.setData(routeData);
  }, [routeData, status]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== 'fallback') {
      setFallbackFootprints([]);
      setFallbackRoutes([]);
      return;
    }
    let frame = 0;
    const update = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const bounds = map.getContainer().getBoundingClientRect();
        const projected = validBuildings.flatMap((building) => {
          const ring = (building.footprint ?? []).filter(([lng, lat]) => validCoordinate(lat, lng));
          if (ring.length < 3) return [];
          return [{
            id: building.id,
            name: `${building.code} ${building.name}`,
            selected: building.id === selectedBuildingId,
            points: ring.map(([lng, lat]) => {
              const point = map.project([lng, lat]);
              return `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
            }).join(' '),
          }];
        });
        const projectedRoute = routeData.features.flatMap((feature, index) => {
          if (feature.geometry.type !== 'LineString') return [];
          const points = feature.geometry.coordinates
            .filter(([lng, lat]) => validCoordinate(lat, lng))
            .map(([lng, lat]) => {
              const point = map.project([lng, lat]);
              return `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
            });
          if (points.length < 2) return [];
          return [{
            index,
            points: points.join(' '),
            saved: feature.properties?.saved === true,
          }];
        });
        setFallbackSize(([width, height]) => width === bounds.width && height === bounds.height
          ? [width, height]
          : [bounds.width, bounds.height]);
        setFallbackFootprints((previous) =>
          JSON.stringify(previous) === JSON.stringify(projected) ? previous : projected,
        );
        setFallbackRoutes((previous) =>
          JSON.stringify(previous) === JSON.stringify(projectedRoute) ? previous : projectedRoute,
        );
      });
    };
    update();
    map.on('move', update);
    map.on('resize', update);
    map.on('rotate', update);
    map.on('pitch', update);
    return () => {
      window.cancelAnimationFrame(frame);
      map.off('move', update);
      map.off('resize', update);
      map.off('rotate', update);
      map.off('pitch', update);
    };
  }, [validBuildings, selectedBuildingId, routeData, status]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || (status !== 'ready' && status !== 'fallback')) return;
    let cancelled = false;
    markerRefs.current.forEach((marker) => marker.remove());
    markerRefs.current = [];
    void import('maplibre-gl').then((ml) => {
      if (cancelled) return;
      visibleMarkers.forEach((item) => {
        const element = document.createElement('div');
        element.className = `campus-map-marker campus-map-marker--${item.tone ?? 'qr'}`;
        element.title = item.label;
        element.setAttribute('aria-label', item.label);
        markerRefs.current.push(
          new ml.Marker({ element })
            .setLngLat([item.lng, item.lat])
            .setPopup(new ml.Popup({ offset: 18 }).setText(item.label))
            .addTo(map),
        );
      });
      validBuildings.forEach((building) => {
        const element = document.createElement('button');
        element.type = 'button';
        element.className = 'campus-map-building-marker';
        element.textContent = building.code;
        element.title = building.name;
        element.setAttribute('aria-label', `Select ${building.code} · ${building.name}`);
        element.setAttribute('aria-pressed', String(building.id === selectedBuildingId));
        element.style.cssText = [
          'min-width:38px',
          'min-height:38px',
          'padding:0 8px',
          'border:2px solid #fff',
          'border-radius:12px',
          `background:${building.id === selectedBuildingId ? '#3730bb' : '#2458b8'}`,
          'color:#fff',
          'font:700 12px/1 system-ui,sans-serif',
          'box-shadow:0 2px 8px #17231c66',
          'cursor:pointer',
        ].join(';');
        element.addEventListener('click', () => callbacks.current.onSelectBuilding?.(building.id));
        element.addEventListener('dblclick', () => callbacks.current.onOpenBuilding?.(building.id));
        markerRefs.current.push(
          new ml.Marker({ element, anchor: 'bottom' })
            .setLngLat([building.lng, building.lat])
            .addTo(map),
        );
      });
    });
    return () => {
      cancelled = true;
      markerRefs.current.forEach((marker) => marker.remove());
      markerRefs.current = [];
    };
  }, [validBuildings, visibleMarkers, selectedBuildingId, status]);

  const toggle3d = () => {
    const map = mapRef.current;
    if (!map) return;
    const next = !is3d;
    setIs3d(next);
    map.easeTo({ pitch: next ? 58 : 0, bearing: next ? -18 : 0, duration: 700 });
  };

  const recenter = () => {
    const map = mapRef.current;
    if (!map || validBuildings.length === 0) return;
    const coordinates = validBuildings.map((building) => [building.lng, building.lat] as [number, number]);
    void import('maplibre-gl').then((ml) => {
      const bounds = coordinates.reduce(
        (box, point) => box.extend(point),
        new ml.LngLatBounds(coordinates[0], coordinates[0]),
      );
      map.fitBounds(bounds, { padding: 55, maxZoom: 18, pitch: is3d ? 58 : 0 });
    });
  };

  const locateUser = () => {
    if (!navigator.geolocation) {
      setMapMessage('This browser does not provide location services. You can still explore the campus map.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (!validCoordinate(coords.latitude, coords.longitude)) {
          setMapMessage('The device returned an invalid location. Try again or choose a campus starting point.');
          return;
        }
        setMapMessage(null);
        setLiveLocation({ lat: coords.latitude, lng: coords.longitude, label: 'Your current location', tone: 'user' });
        mapRef.current?.easeTo({
          center: [coords.longitude, coords.latitude],
          zoom: 18,
          pitch: is3d ? 58 : 0,
          duration: 650,
        });
      },
      () => setMapMessage('Location permission was denied or unavailable. You can still explore the campus map.'),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 },
    );
  };

  return (
    <div
      className={cx('relative overflow-hidden rounded-[var(--radius-card)] border border-ink-200 bg-[#e9efe9] shadow-[var(--shadow-card)]', className)}
      style={{ height }}
    >
      <div
        ref={host}
        className="h-full w-full"
        role="application"
        aria-label={`Interactive 3D campus map with ${buildings.length} buildings`}
      />
      {status === 'fallback' && fallbackFootprints.length > 0 && (
        <svg
          className="pointer-events-none absolute inset-0 z-0 h-full w-full"
          data-testid="offline-campus-geometry"
          viewBox={`0 0 ${fallbackSize[0]} ${fallbackSize[1]}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {fallbackFootprints.map((footprint) => (
            <polygon
              key={footprint.id}
              points={footprint.points}
              fill={footprint.selected ? '#4f46e5' : '#6685bf'}
              fillOpacity={0.35}
              stroke={footprint.selected ? '#3730bb' : '#2458b8'}
              strokeWidth={footprint.selected ? 3 : 2}
              aria-label={footprint.name}
            />
          ))}
          {fallbackRoutes.map((segment) => (
            <polyline
              key={segment.index}
              points={segment.points}
              fill="none"
              stroke={segment.saved ? '#2458b8' : '#b7791f'}
              strokeWidth={5}
              strokeDasharray={segment.saved ? undefined : '8 6'}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </svg>
      )}
      {status === 'loading' && (
        <div className="absolute inset-0 grid place-items-center bg-[#e9efe9] text-sm font-semibold text-ink-600" role="status">
          {mapMessage ?? 'Loading campus map…'}
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-x-4 top-16 z-10 rounded-xl border border-coral-200 bg-white/95 p-4 shadow-lg" role="alert">
          <p className="text-sm font-semibold text-coral-700">{mapMessage}</p>
          <Button className="mt-3" size="sm" variant="secondary" onClick={() => setRetryKey((key) => key + 1)}>
            Retry map
          </Button>
        </div>
      )}
      <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-2">
        <button type="button" onClick={toggle3d} disabled={status === 'loading' || status === 'error'} className="rounded-xl border border-white/70 bg-white/95 px-3 py-2 text-xs font-bold text-brand-700 shadow-lg disabled:opacity-50">
          {is3d ? '2D plan' : '3D buildings'}
        </button>
        <button type="button" onClick={recenter} disabled={validBuildings.length === 0} className="rounded-xl border border-white/70 bg-white/95 px-3 py-2 text-xs font-bold text-ink-700 shadow-lg disabled:opacity-50">
          Campus view
        </button>
        <button type="button" onClick={locateUser} disabled={status === 'loading' || status === 'error'} className="rounded-xl border border-white/70 bg-white/95 px-3 py-2 text-xs font-bold text-ink-700 shadow-lg disabled:opacity-50">
          My location
        </button>
      </div>
      {mapMessage && status !== 'loading' && status !== 'error' && (
        <p className="absolute inset-x-3 bottom-16 z-10 rounded-lg bg-white/95 px-3 py-2 text-xs text-ink-700 shadow" role="status">
          {mapMessage}
        </p>
      )}
      {status === 'fallback' && !mapMessage && (
        <p className="absolute inset-x-3 bottom-16 z-10 rounded-lg bg-white/95 px-3 py-2 text-xs text-ink-700 shadow" role="status">
          Offline map view · showing saved CampusFlow geometry only.
        </p>
      )}
      <div className="pointer-events-none absolute bottom-7 left-3 rounded-xl bg-slate-950/80 px-3 py-2 text-[10px] text-white backdrop-blur">
        <strong>3D CAMPUS</strong> · OSM building detail · CampusFlow paths
      </div>
      <div className="sr-only" data-testid="outdoor-route">
        {routeData.features.length ? 'Published outdoor route shown' : ''}
      </div>
    </div>
  );
}

export function positionMarker(position: Position | null): MapMarker[] {
  if (!position || position.lat === null || position.lng === null) return [];
  return [{ lat: position.lat, lng: position.lng, label: position.building_code ? `You · ${position.building_code}` : 'You', tone: 'user' }];
}
