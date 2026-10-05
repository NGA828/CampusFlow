import MapLibreGL from '@maplibre/maplibre-react-native';
import { Text, View } from 'react-native';
import { colours } from '../theme';
import { STYLE_URL, type CampusMapProps } from './map-types';

/**
 * Native campus map (iOS/Android) — MapLibre Native through its React Native binding.
 *
 * The route is drawn through the very nodes the server routed over, so what the
 * student sees on the map and the step list underneath can never disagree.
 */
export function CampusMapView({ centre, zoom, buildings, gps, indoor, route }: CampusMapProps) {
  return (
    <MapLibreGL.MapView style={{ flex: 1 }} mapStyle={STYLE_URL}>
      <MapLibreGL.Camera centerCoordinate={centre} zoomLevel={zoom} animationDuration={700} />

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

      {buildings.map((building) => (
        <MapLibreGL.PointAnnotation key={building.id} id={building.id} coordinate={building.coordinates}>
          <View style={{ paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8, backgroundColor: colours.ink }}>
            <Text style={{ color: 'white', fontSize: 11, fontWeight: '800' }}>{building.code}</Text>
          </View>
        </MapLibreGL.PointAnnotation>
      ))}

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
