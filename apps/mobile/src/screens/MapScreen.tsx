import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { ApiError, api } from '../api';
import { CampusMapView } from '../components/CampusMapView';
import { MapBoundary } from '../components/MapFallback';
import { colours, styles } from '../theme';
import type { CampusModel, IndoorRoute, Position } from '../types';

/**
 * Outdoor and indoor guidance on one map.
 *
 * Outdoors the phone's GPS places the student and the campus is the destination;
 * indoors the position comes from a scanned QR anchor and the route is the server's
 * graph path, drawn through the very nodes it routed over.
 */
function metresBetween(a: [number, number], b: [number, number]): number {
  const R = 6_371_000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

export function MapScreen({ position }: { position: Position | null }) {
  const [campus, setCampus] = useState<CampusModel | null>(null);
  const [destination, setDestination] = useState<string>('');
  const [stepFree, setStepFree] = useState(false);
  const [route, setRoute] = useState<IndoorRoute | null>(null);
  const [gps, setGps] = useState<[number, number] | null>(null);
  const [gpsNote, setGpsNote] = useState<string>('Recherche du signal GPS…');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api<CampusModel>('/universities/iai-cameroun/campus')
      .then((payload) => {
        setCampus(payload);
        setDestination(payload.rooms[0]?.id ?? '');
      })
      .catch(() => setError('Le plan du campus n’a pas pu être chargé.'));
  }, []);

  // A single fix is not enough to walk with: the subscription keeps the outdoor dot
  // honest while the student moves, and is torn down with the screen.
  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;
    let stopped = false;

    void (async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!permission.granted) {
          setGpsNote('Localisation refusée : la carte reste utilisable, sans votre position extérieure.');
          return;
        }
        subscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, distanceInterval: 10, timeInterval: 5000 },
          (fix) => {
            if (!stopped) setGps([fix.coords.longitude, fix.coords.latitude]);
          },
        );
      } catch {
        setGpsNote('GPS indisponible sur cet appareil.');
      }
    })();

    return () => {
      stopped = true;
      subscription?.remove();
    };
  }, []);

  async function plan() {
    // A student who has not scanned anything yet is almost always arriving: routing
    // from the main gate is more useful than refusing to route at all.
    const from = position?.nodeId ?? 'lm-gate';
    try {
      const payload = await api<{ route: IndoorRoute }>('/navigation/route', {
        method: 'POST',
        body: { from, to: destination, stepFree },
      });
      setRoute(payload.route);
      setError(null);
    } catch (caught) {
      setRoute(null);
      setError(caught instanceof ApiError ? caught.message : 'L’itinéraire n’a pas pu être calculé.');
    }
  }

  const centre = position?.coordinates ?? campus?.university.coordinates ?? [11.55852, 3.81384];
  const routeLine = useMemo<[number, number][] | null>(
    () => (route && route.steps.length > 1 ? route.steps.map((step) => step.coordinates) : null),
    [route],
  );
  const toCampus = gps && campus ? metresBetween(gps, campus.university.coordinates) : null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>Navigation</Text>
      <Text style={styles.title}>Carte et itinéraires</Text>
      <Text style={styles.subtitle}>
        {gps ? 'Position GPS acquise. ' : `${gpsNote} `}
        {position
          ? `Position intérieure : ${position.label}.`
          : 'Sans scan, l’itinéraire part du portail principal.'}
      </Text>

      {error ? <Text style={[styles.notice, styles.noticeError]}>{error}</Text> : null}

      <View style={styles.map}>
        <MapBoundary>
          <CampusMapView
            centre={centre}
            zoom={position ? 18 : 16}
            boundary={campus?.boundary?.ring ?? null}
            buildings={campus?.buildings ?? []}
            landmarks={campus?.landmarks ?? []}
            gps={gps}
            indoor={position?.coordinates ?? null}
            route={routeLine}
          />
        </MapBoundary>
      </View>

      {toCampus !== null && campus ? (
        <Text style={styles.notice}>
          {toCampus > 1000
            ? `${(toCampus / 1000).toFixed(1)} km vous séparent du campus ${campus.university.shortName} — environ ${Math.round(
                toCampus / 80,
              )} min en voiture.`
            : `Vous êtes à ${toCampus} m du campus ${campus.university.shortName} — environ ${Math.max(
                1,
                Math.round(toCampus / 80),
              )} min à pied.`}
        </Text>
      ) : null}

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
