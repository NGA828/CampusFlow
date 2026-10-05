import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';
import * as Location from 'expo-location';
import { ApiError, api } from '../api';
import { colours, styles } from '../theme';
import type { CampusModel, IndoorRoute, Position } from '../types';

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

/**
 * Outdoor and indoor guidance on one map.
 *
 * Outdoors the phone's GPS places the student and the campus is the destination;
 * indoors the position comes from a scanned QR anchor and the route is the server's
 * graph path, drawn through the very nodes it routed over.
 */
export function MapScreen({ position }: { position: Position | null }) {
  const [campus, setCampus] = useState<CampusModel | null>(null);
  const [destination, setDestination] = useState<string>('');
  const [stepFree, setStepFree] = useState(false);
  const [route, setRoute] = useState<IndoorRoute | null>(null);
  const [gps, setGps] = useState<[number, number] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api<CampusModel>('/universities/iai-cameroun/campus')
      .then((payload) => {
        setCampus(payload);
        setDestination(payload.rooms[0]?.id ?? '');
      })
      .catch(() => setError('The campus model could not be loaded.'));
  }, []);

  useEffect(() => {
    void (async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) return;
      const fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setGps([fix.coords.longitude, fix.coords.latitude]);
    })();
  }, []);

  async function plan() {
    if (!position) {
      setError('Scannez d’abord une ancre QR : un itinéraire a besoin d’un point de départ.');
      return;
    }
    try {
      const payload = await api<{ route: IndoorRoute }>('/navigation/route', {
        method: 'POST',
        body: { from: position.nodeId, to: destination, stepFree },
      });
      setRoute(payload.route);
      setError(null);
    } catch (caught) {
      setRoute(null);
      setError(caught instanceof ApiError ? caught.message : 'L’itinéraire n’a pas pu être calculé.');
    }
  }

  const centre = position?.coordinates ?? campus?.university.coordinates ?? [11.55852, 3.81384];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>Navigation</Text>
      <Text style={styles.title}>Carte et itinéraires</Text>
      <Text style={styles.subtitle}>
        {gps ? 'Position GPS acquise pour le trajet extérieur. ' : 'GPS non disponible pour l’instant. '}
        {position ? `Position intérieure : ${position.label}.` : 'Scannez une ancre pour l’intérieur.'}
      </Text>

      {error ? <Text style={[styles.notice, styles.noticeError]}>{error}</Text> : null}

      <View style={styles.map}>
        <MapLibreGL.MapView style={{ flex: 1 }} mapStyle={STYLE_URL}>
          <MapLibreGL.Camera centerCoordinate={centre} zoomLevel={position ? 18 : 16} animationDuration={700} />
          {gps ? (
            <MapLibreGL.PointAnnotation id="gps" coordinate={gps}>
              <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: colours.brand, borderWidth: 2, borderColor: 'white' }} />
            </MapLibreGL.PointAnnotation>
          ) : null}
          {position ? (
            <MapLibreGL.PointAnnotation id="indoor" coordinate={position.coordinates}>
              <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: colours.gold, borderWidth: 2, borderColor: 'white' }} />
            </MapLibreGL.PointAnnotation>
          ) : null}
          {(campus?.buildings ?? []).map((building) => (
            <MapLibreGL.PointAnnotation key={building.id} id={building.id} coordinate={building.coordinates}>
              <View style={{ paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8, backgroundColor: colours.ink }}>
                <Text style={{ color: 'white', fontSize: 11, fontWeight: '800' }}>{building.code}</Text>
              </View>
            </MapLibreGL.PointAnnotation>
          ))}
          {route && route.steps.length > 1 ? (
            <MapLibreGL.ShapeSource
              id="route"
              shape={{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: route.steps.map((step) => step.coordinates) } }}
            >
              <MapLibreGL.LineLayer id="route-line" style={{ lineColor: colours.brand, lineWidth: 5, lineCap: 'round', lineJoin: 'round' }} />
            </MapLibreGL.ShapeSource>
          ) : null}
        </MapLibreGL.MapView>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Destination</Text>
        {(campus?.rooms ?? []).map((room) => (
          <Pressable
            key={room.id}
            accessibilityRole="button"
            style={[styles.button, styles.buttonGhost, destination === room.id && { borderColor: colours.brand }]}
            onPress={() => setDestination(room.id)}
          >
            <Text style={styles.buttonGhostText}>
              {room.code} — {room.name}
            </Text>
          </Pressable>
        ))}
        <View style={[styles.row, { alignItems: 'center' }]}>
          <Text style={styles.muted}>Itinéraire sans marches (ascenseur)</Text>
          <Switch value={stepFree} onValueChange={setStepFree} />
        </View>
        <Pressable accessibilityRole="button" style={styles.button} onPress={() => void plan()}>
          <Text style={styles.buttonText}>Calculer l’itinéraire</Text>
        </Pressable>
      </View>

      {route ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {route.totalDistanceMetres} m · environ {route.estimatedMinutes} min{route.stepFree ? ' · sans marches' : ''}
          </Text>
          {route.steps.map((step, index) => (
            <View key={step.nodeId} style={styles.step}>
              <Text style={styles.stepIndex}>{index + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text>{step.instruction}</Text>
                <Text style={styles.muted}>
                  {step.floorName}
                  {step.distanceMetres > 0 ? ` · ${step.distanceMetres} m` : ''}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}
