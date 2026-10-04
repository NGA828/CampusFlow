import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card, Small, SectionTitle } from '@/components/ui';
import { colors, spacing } from '@/lib/theme';
import type { MobileRouteLeg, MobileRouteNode } from '@/lib/api';
import type { Position } from '@/lib/types';

type Point = { x: number; y: number };
type ScreenPoint = Point & { key: string };

function isFinitePoint(point: Point): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

function geoDistanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const lat1 = radians(a.lat);
  const lat2 = radians(b.lat);
  const deltaLat = radians(b.lat - a.lat);
  const deltaLng = radians(b.lng - a.lng);
  const haversine = Math.sin(deltaLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function geometry(leg: MobileRouteLeg): Point[] {
  if (leg.floor_id) {
    return leg.points.filter(isFinitePoint);
  }
  return leg.geo
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng))
    .map((point) => ({ x: point.lng, y: -point.lat }));
}

function livePoint(leg: MobileRouteLeg, position: Position | null): Point | null {
  if (!position) return null;
  if (leg.floor_id) {
    return position.floor_id === leg.floor_id
      && Number.isFinite(position.plan_x)
      && Number.isFinite(position.plan_y)
      ? { x: position.plan_x as number, y: position.plan_y as number }
      : null;
  }
  return Number.isFinite(position.lat) && Number.isFinite(position.lng)
    ? { x: position.lng, y: -position.lat }
    : null;
}

function RouteLegTrace({ leg, originPosition, position, isFirst, isLast, isOriginSnap = false }: {
  leg: MobileRouteLeg;
  originPosition: Position | null;
  position: Position | null;
  isFirst: boolean;
  isLast: boolean;
  isOriginSnap?: boolean;
}) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const path = useMemo(() => geometry(leg), [leg]);
  const here = livePoint(leg, position);
  const origin = isFirst ? livePoint(leg, originPosition) : null;
  const bounds = useMemo(() => {
    const all = [...path, ...(here ? [here] : []), ...(origin ? [origin] : [])];
    if (!all.length) return null;
    const xs = all.map((point) => point.x);
    const ys = all.map((point) => point.y);
    return {
      minX: Math.min(...xs), maxX: Math.max(...xs),
      minY: Math.min(...ys), maxY: Math.max(...ys),
    };
  }, [path, here, origin]);

  const toScreen = (point: Point, key: string): ScreenPoint | null => {
    if (!bounds || !size.width || !size.height) return null;
    const pad = 22;
    const spanX = bounds.maxX - bounds.minX || 1;
    const spanY = bounds.maxY - bounds.minY || 1;
    const scale = Math.min((size.width - pad * 2) / spanX, (size.height - pad * 2) / spanY);
    const drawnWidth = spanX * scale;
    const drawnHeight = spanY * scale;
    const originX = (size.width - drawnWidth) / 2;
    const originY = (size.height - drawnHeight) / 2;
    return {
      key,
      x: originX + (point.x - bounds.minX) * scale,
      y: originY + (point.y - bounds.minY) * scale,
    };
  };

  const screenPath = path.map((point, index) => toScreen(point, `route-${index}`)).filter((point): point is ScreenPoint => point !== null);
  const screenHere = here ? toScreen(here, 'you') : null;
  const screenOrigin = origin ? toScreen(origin, 'origin') : null;
  const screenStart = isFirst ? screenOrigin ?? screenPath[0] ?? null : null;
  const title = isOriginSnap ? 'GPS start snap to nearest mapped node' : leg.floor_id
    ? `${leg.building_code ? `${leg.building_code} · ` : ''}${leg.floor_name ?? 'Indoor floor'}`
    : 'Campus grounds';
  const hasLine = screenPath.length > 1;

  return (
    <View style={styles.leg}>
      <View style={styles.legHeading}>
        <View style={{ flex: 1 }}>
          <Small style={styles.legTitle}>{title}</Small>
          <Small>{Math.round(leg.distance_m)} m on this section</Small>
        </View>
        {isFirst ? <Small style={styles.markerText}>START</Small> : null}
        {isLast ? <Small style={styles.markerText}>DESTINATION</Small> : null}
      </View>
      {hasLine ? (
        <View
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            if (width !== size.width || height !== size.height) setSize({ width, height });
          }}
          style={styles.canvas}
          accessibilityRole="image"
          accessibilityLabel={`${title} route trace${screenHere ? ', current location shown' : ''}`}
        >
          {[0, 1, 2, 3].map((index) => (
            <View key={`grid-x-${index}`} pointerEvents="none" style={[styles.gridLine, { left: `${index * 33.333}%`, top: 0, bottom: 0, width: StyleSheet.hairlineWidth }]} />
          ))}
          {[0, 1, 2].map((index) => (
            <View key={`grid-y-${index}`} pointerEvents="none" style={[styles.gridLine, { top: `${index * 50}%`, left: 0, right: 0, height: StyleSheet.hairlineWidth }]} />
          ))}
          {screenOrigin && screenPath[0] ? (() => {
            const dx = screenPath[0].x - screenOrigin.x;
            const dy = screenPath[0].y - screenOrigin.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            if (length < 2) return null;
            return (
              <View
                key="origin-snap"
                pointerEvents="none"
                style={[
                  styles.routeConnector,
                  {
                    left: (screenOrigin.x + screenPath[0].x) / 2 - length / 2,
                    top: (screenOrigin.y + screenPath[0].y) / 2 - 1,
                    width: length,
                    transform: [{ rotate: `${Math.atan2(dy, dx)}rad` }],
                  },
                ]}
              />
            );
          })() : null}
          {screenPath.slice(1).map((point, index) => {
            const from = screenPath[index];
            const dx = point.x - from.x;
            const dy = point.y - from.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            if (!Number.isFinite(length) || length < 1) return null;
            const hasSavedGeometry = leg.segment_geometry?.[index] ?? false;
            return (
              <View
                key={point.key}
                pointerEvents="none"
                style={[
                  isOriginSnap ? styles.routeConnector : hasSavedGeometry ? styles.routeLine : styles.routeFallbackLine,
                  {
                    left: (from.x + point.x) / 2 - length / 2,
                    top: (from.y + point.y) / 2 - 2,
                    width: length,
                    transform: [{ rotate: `${Math.atan2(dy, dx)}rad` }],
                  },
                ]}
              />
            );
          })}
          {screenPath.map((point, index) => (
            <View
              key={point.key}
              pointerEvents="none"
              style={[
                styles.waypoint,
                {
                  left: point.x - 4,
                  top: point.y - 4,
                  backgroundColor: isFirst && index === 0 ? colors.brand600 : isLast && index === screenPath.length - 1 ? colors.mint700 : colors.white,
                  borderColor: isFirst && index === 0 ? colors.brand600 : isLast && index === screenPath.length - 1 ? colors.mint700 : colors.brand300,
                },
              ]}
            />
          ))}
          {screenHere ? (
            <View pointerEvents="none" style={[styles.youPin, { left: screenHere.x - 9, top: screenHere.y - 9 }]}>
              <View style={styles.youDot} />
            </View>
          ) : null}
          {screenStart ? (
            <View pointerEvents="none" style={[styles.startPin, { left: screenStart.x - 6, top: screenStart.y - 6 }]} />
          ) : null}
          {isLast && screenPath.at(-1) ? (
            <View pointerEvents="none" style={[styles.destinationPin, { left: screenPath.at(-1)!.x - 6, top: screenPath.at(-1)!.y - 6 }]} />
          ) : null}
        </View>
      ) : (
        <View style={styles.noGeometry}>
          <Small>This section has no published line geometry yet. Ask campus staff to map this path.</Small>
        </View>
      )}
    </View>
  );
}

export function RouteTrace({ legs, originPosition, position, originNode }: { legs: MobileRouteLeg[]; originPosition: Position | null; position: Position | null; originNode?: MobileRouteNode | null }) {
  const gpsOrigin = originPosition?.source === 'gps'
    && Number.isFinite(originPosition.lat) && Number.isFinite(originPosition.lng);
  const canMeasureGpsSnap = gpsOrigin && Number.isFinite(originNode?.lat) && Number.isFinite(originNode?.lng);
  const gpsSnapDistance = canMeasureGpsSnap
    ? geoDistanceMeters(originPosition, { lat: originNode!.lat!, lng: originNode!.lng! })
    : null;
  const gpsSnapLeg: MobileRouteLeg | null = canMeasureGpsSnap && gpsSnapDistance !== null && gpsSnapDistance <= 350
    ? {
      floor_id: null,
      floor_name: 'GPS start snap',
      floor_level: null,
      building_code: null,
      distance_m: gpsSnapDistance,
      duration_s: 0,
      points: [],
      geo: [
        { lat: originPosition.lat, lng: originPosition.lng },
        { lat: originNode!.lat!, lng: originNode!.lng! },
      ],
    }
    : null;
  const mapped = legs
    .map((leg, routeIndex) => ({ leg, routeIndex }))
    .filter(({ leg }) => geometry(leg).length > 0);
  // GPS cannot distinguish floors; do not place an outdoor fix on an indoor floor map.
  const mappedPosition = originPosition?.floor_id && position?.source === 'gps' ? null : position;
  const positionLegIndex = mapped.findIndex(({ leg }) => livePoint(leg, mappedPosition) !== null);
  const originMatchesFirstLeg = !gpsSnapLeg && mapped[0]?.routeIndex === 0 && livePoint(mapped[0].leg, originPosition) !== null;
  return (
    <Card style={styles.card}>
      <SectionTitle title="Route map" />
      <Small style={styles.caption}>Solid blue segments use saved edge bends; amber dashed segments are straight fallbacks between route nodes. Saved geometry still needs checking against real walkways and closures. The blue dot is your current position when it can be matched to this section.</Small>
      {gpsSnapLeg ? <Small style={styles.indoorNote}>Dashed line: your GPS fix to the nearest mapped route node. This is a snap connector, not a verified walkway.</Small> : null}
      {gpsOrigin && gpsSnapDistance !== null && gpsSnapDistance > 350 ? <Small style={styles.indoorNote}>Your GPS fix is {Math.round(gpsSnapDistance)} m from the route’s starting node; no snap connector is drawn at that distance.</Small> : null}
      {originMatchesFirstLeg ? <Small style={styles.indoorNote}>The short dashed line joins your location fix to the nearest published walking node.</Small> : null}
      {originPosition?.floor_id && position?.source === 'gps' ? <Small style={styles.indoorNote}>GPS cannot locate your floor indoors. Scan a nearby QR anchor to refresh your indoor marker.</Small> : null}
      {mapped.length > 0 && mapped.length < legs.length ? <Small style={styles.indoorNote}>Some sections do not have published map geometry and are intentionally left unconnected.</Small> : null}
      {gpsSnapLeg ? <RouteLegTrace
        key="gps-origin-snap"
        leg={gpsSnapLeg}
        originPosition={originPosition}
        position={position}
        isFirst
        isLast={false}
        isOriginSnap
      /> : null}
      {mapped.length ? mapped.map(({ leg, routeIndex }, index) => (
        <RouteLegTrace
          key={`${leg.floor_id ?? 'outdoor'}-${routeIndex}`}
          leg={leg}
          originPosition={originPosition}
          position={index === positionLegIndex ? mappedPosition : null}
          isFirst={!gpsSnapLeg && routeIndex === 0}
          isLast={routeIndex === legs.length - 1}
        />
      )) : (
        <View style={styles.noGeometry}>
          <Small>The route is calculated, but this route has no mapped coordinates to draw yet. Campus staff need to publish path geometry.</Small>
        </View>
      )}
      <View style={styles.legend}>
        <View style={[styles.legendDot, { backgroundColor: colors.brand600 }]} /><Small>Start</Small>
        <View style={[styles.legendDot, { backgroundColor: colors.mint700 }]} /><Small>Destination</Small>
        {positionLegIndex >= 0 ? <><View style={[styles.legendDot, styles.legendYou]} /><Small>You</Small></> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: spacing.lg },
  caption: { marginTop: -4, marginBottom: spacing.md },
  indoorNote: { marginTop: -spacing.sm, marginBottom: spacing.sm, color: colors.brand700 },
  leg: { marginTop: spacing.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.ink100, borderRadius: 16, backgroundColor: '#f6faf8' },
  legHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.white },
  legTitle: { color: colors.ink800, fontWeight: '800' },
  markerText: { color: colors.brand700, fontWeight: '800', fontSize: 10 },
  canvas: { height: 176, position: 'relative', overflow: 'hidden' },
  gridLine: { position: 'absolute', backgroundColor: '#dce8e1' },
  routeLine: { position: 'absolute', height: 4, borderRadius: 4, backgroundColor: colors.brand600 },
  routeFallbackLine: { position: 'absolute', height: 2, borderTopWidth: 2, borderColor: '#b7791f', borderStyle: 'dashed' },
  routeConnector: { position: 'absolute', height: 2, borderTopWidth: 2, borderColor: colors.mint600, borderStyle: 'dashed' },
  waypoint: { position: 'absolute', width: 8, height: 8, borderWidth: 2, borderRadius: 4 },
  startPin: { position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: colors.brand600, borderWidth: 2, borderColor: colors.white },
  destinationPin: { position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: colors.mint700, borderWidth: 2, borderColor: colors.white },
  youPin: { position: 'absolute', width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#bfdbfe', borderWidth: 2, borderColor: '#2563eb' },
  youDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#1d4ed8' },
  noGeometry: { marginTop: spacing.md, padding: spacing.md, borderRadius: 12, backgroundColor: colors.ink50 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md, flexWrap: 'wrap' },
  legendDot: { width: 9, height: 9, borderRadius: 5, marginLeft: 8 },
  legendYou: { backgroundColor: '#2563eb' },
});
