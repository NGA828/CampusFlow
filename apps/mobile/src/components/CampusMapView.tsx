import MapLibreGL from '@maplibre/maplibre-react-native';
import { Text, View } from 'react-native';
import { colours } from '../theme';
import { LANDMARK_GLYPH, STYLE_URL, type CampusMapProps } from './map-types';

/**
 * Native campus map (iOS/Android) — MapLibre Native through its React Native binding.
 *
 * Same three layers as the web map and in the same order: the surveyed perimeter,
 * the building footprints, then the landmarks a student actually navigates by. The
 * route is drawn through the very nodes the server routed over, so what the student
 * sees on the map and the step list underneath can never disagree.
 */
export function CampusMapView({ centre, zoom, boundary, buildings, landmarks, gps, indoor, route, plan }: CampusMapProps) {
  const footprints = buildings.filter((building) => building.footprint);

  return (
    <MapLibreGL.MapView style={{ flex: 1 }} mapStyle={STYLE_URL}>
      <MapLibreGL.Camera centerCoordinate={centre} zoomLevel={zoom} animationDuration={700} />

      {boundary ? (
        <MapLibreGL.ShapeSource
          id="campus-perimeter"
          shape={{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [boundary] } }}
        >
          <MapLibreGL.FillLayer id="campus-perimeter-fill" style={{ fillColor: colours.brand, fillOpacity: 0.07 }} />
          <MapLibreGL.LineLayer
            id="campus-perimeter-line"
            style={{ lineColor: colours.brand, lineWidth: 2, lineDasharray: [3, 2], lineOpacity: 0.8 }}
          />
        </MapLibreGL.ShapeSource>
      ) : null}

      {footprints.length ? (
        <MapLibreGL.ShapeSource
          id="campus-buildings"
          shape={{
            type: 'FeatureCollection',
            features: footprints.map((building) => ({
              type: 'Feature' as const,
              properties: { code: building.code },
              geometry: { type: 'Polygon' as const, coordinates: [building.footprint as [number, number][]] },
            })),
          }}
        >
          <MapLibreGL.FillLayer id="campus-buildings-fill" style={{ fillColor: colours.ink, fillOpacity: 0.5 }} />
          <MapLibreGL.LineLayer id="campus-buildings-line" style={{ lineColor: colours.ink, lineWidth: 1.5 }} />
        </MapLibreGL.ShapeSource>
      ) : null}

      {plan && plan.corridors.length ? (
        <MapLibreGL.ShapeSource
          id="floor-corridors"
          shape={{
            type: 'FeatureCollection',
            features: plan.corridors.map((corridor) => ({
              type: 'Feature' as const,
              properties: {},
              geometry: { type: 'LineString' as const, coordinates: corridor },
            })),
          }}
        >
          <MapLibreGL.LineLayer
            id="floor-corridors-line"
            style={{ lineColor: '#9aa6c8', lineWidth: 6, lineOpacity: 0.7, lineCap: 'round' }}
          />
        </MapLibreGL.ShapeSource>
      ) : null}

      {plan && plan.rooms.length ? (
        <MapLibreGL.ShapeSource
          id="floor-rooms"
          shape={{
            type: 'FeatureCollection',
            features: plan.rooms.map((room) => ({
              type: 'Feature' as const,
              properties: { code: room.code, bookable: room.bookable },
              geometry: { type: 'Polygon' as const, coordinates: [room.polygon] },
            })),
          }}
        >
          <MapLibreGL.FillLayer
            id="floor-rooms-fill"
            style={{
              fillColor: ['case', ['get', 'bookable'], colours.brand, '#f4f6ff'],
              fillOpacity: ['case', ['get', 'bookable'], 0.55, 0.9],
            }}
          />
          <MapLibreGL.LineLayer id="floor-rooms-line" style={{ lineColor: colours.ink, lineWidth: 1 }} />
        </MapLibreGL.ShapeSource>
      ) : null}

      {(plan?.rooms ?? []).map((room) => (
        <MapLibreGL.PointAnnotation key={room.id} id={`room-${room.id}`} coordinate={room.centre} title={room.name}>
          <View style={{ paddingHorizontal: 3, paddingVertical: 1, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.85)' }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: colours.ink }}>{room.code}</Text>
          </View>
        </MapLibreGL.PointAnnotation>
      ))}

      {landmarks.map((landmark) => (
        <MapLibreGL.PointAnnotation key={landmark.id} id={landmark.id} coordinate={landmark.coordinates} title={landmark.name}>
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colours.white,
              borderWidth: 1,
              borderColor: '#cfd6ec',
            }}
          >
            <Text style={{ fontSize: 11 }}>{LANDMARK_GLYPH[landmark.kind] ?? '•'}</Text>
          </View>
        </MapLibreGL.PointAnnotation>
      ))}

      {buildings.map((building) => (
        <MapLibreGL.PointAnnotation key={building.id} id={building.id} coordinate={building.coordinates} title={building.name}>
          <View style={{ paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8, backgroundColor: colours.ink }}>
            <Text style={{ color: 'white', fontSize: 11, fontWeight: '800' }}>{building.code}</Text>
          </View>
        </MapLibreGL.PointAnnotation>
      ))}

      {gps ? (
        <MapLibreGL.PointAnnotation id="gps" coordinate={gps}>
          <View
            style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: colours.brand, borderWidth: 2, borderColor: 'white' }}
          />
        </MapLibreGL.PointAnnotation>
      ) : null}

      {indoor ? (
        <MapLibreGL.PointAnnotation id="indoor" coordinate={indoor}>
          <View
            style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: colours.gold, borderWidth: 2, borderColor: 'white' }}
          />
        </MapLibreGL.PointAnnotation>
      ) : null}

      {route && route.length > 1 ? (
        <MapLibreGL.ShapeSource
          id="route"
          shape={{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: route } }}
        >
          <MapLibreGL.LineLayer
            id="route-line"
            style={{ lineColor: colours.brand, lineWidth: 5, lineCap: 'round', lineJoin: 'round' }}
          />
        </MapLibreGL.ShapeSource>
      ) : null}
    </MapLibreGL.MapView>
  );
}
