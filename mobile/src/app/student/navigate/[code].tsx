import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { AdaptiveRow, Badge, Button, Card, ErrorNote, Eyebrow, H2, H3, KeyValue, Loading, ProgressBar, Screen, SectionTitle, Small, Stat, Title } from '@/components/ui';
import { RouteTrace } from '@/components/route-trace';
import { ApiError, navigationApi, positioningApi, type MobileRoute, type NavigationPositionUpdate, type NavigationSessionState } from '@/lib/api';
import type { Position } from '@/lib/types';
import { colors, countdown, spacing } from '@/lib/theme';

export default function NavigateScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const [session, setSession] = useState<NavigationSessionState | null>(null);
  const [accessible, setAccessible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<NavigationPositionUpdate | null>(null);
  const [routeOrigin, setRouteOrigin] = useState<Position | null>(null);
  const [currentPosition, setCurrentPosition] = useState<Position | null>(null);
  const [tracking, setTracking] = useState(false);
  const subscription = useRef<Location.LocationSubscription | null>(null);
  const sessionRef = useRef<NavigationSessionState | null>(null);
  const lastPost = useRef(0);

  sessionRef.current = session;

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const { position: saved } = await positioningApi.current().catch(() => ({ position: null }));
      const savedAt = saved?.recorded_at ?? saved?.updated_at;
      const freshIndoorFix = saved?.source === 'qr'
        && Boolean(saved.floor_id)
        && Number.isFinite(saved.plan_x)
        && Number.isFinite(saved.plan_y)
        && (!savedAt || Date.now() - Date.parse(savedAt) < 30 * 60 * 1000);

      let origin: Parameters<typeof navigationApi.start>[0];
      if (freshIndoorFix && saved) {
        origin = {
          from_plan_x: saved.plan_x as number,
          from_plan_y: saved.plan_y as number,
          from_floor_id: saved.floor_id as string,
          from_building_id: saved.building_id ?? undefined,
        };
        setCurrentPosition(saved);
        setRouteOrigin(saved);
      } else {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== 'granted') {
          if (freshIndoorFix && saved?.floor_id && Number.isFinite(saved.plan_x) && Number.isFinite(saved.plan_y)) {
            origin = {
              from_plan_x: saved.plan_x as number,
              from_plan_y: saved.plan_y as number,
              from_floor_id: saved.floor_id,
              from_building_id: saved.building_id ?? undefined,
            };
            setCurrentPosition(saved);
            setRouteOrigin(saved);
          } else {
            throw new Error('Allow location access or scan a nearby CampusFlow QR anchor to set your starting point.');
          }
        } else {
          const fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          origin = { from_lat: fix.coords.latitude, from_lng: fix.coords.longitude };
          const gpsPosition: Position = {
            lat: fix.coords.latitude,
            lng: fix.coords.longitude,
            plan_x: null,
            plan_y: null,
            building_id: null,
            floor_id: null,
            source: 'gps',
            accuracy_m: fix.coords.accuracy,
            updated_at: new Date(fix.timestamp).toISOString(),
          };
          setCurrentPosition(gpsPosition);
          setRouteOrigin(gpsPosition);
        }
      }

      const result = await navigationApi.start({ to_room_code: String(code), accessible, ...origin });
      if (!result.session || !result.route) throw new Error('The navigation service returned an incomplete route.');
      setSession(result);
      setProgress(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? (caught.firstError ?? caught.message) : caught instanceof Error ? caught.message : 'Could not compute a route to that room.');
    } finally {
      setBusy(false);
    }
  };

  const push = async (coords: { latitude: number; longitude: number; accuracy: number | null }) => {
    const current = sessionRef.current;
    if (!current?.session) return;
    try {
      setCurrentPosition((previous) => ({
        lat: coords.latitude,
        lng: coords.longitude,
        plan_x: null,
        plan_y: null,
        building_id: null,
        floor_id: null,
        source: 'gps',
        accuracy_m: coords.accuracy,
        updated_at: new Date().toISOString(),
        ...(previous?.building_name ? { building_name: previous.building_name } : {}),
      }));
      const result = await navigationApi.updatePosition(current.session.id, {
        lat: coords.latitude,
        lng: coords.longitude,
        accuracy_m: coords.accuracy,
        source: 'gps',
      });
      setProgress(result);
      if (result.navigation?.arrived) {
        Alert.alert('Arrived', `You have reached ${current.destination_label ?? 'your destination'}.`);
        stopTracking();
      }
    } catch {
      // A dropped fix must not break the walk; the next one retries.
    }
  };

  /** Pause is a server state, not just a stopped watch: the ticket and the ETA both depend on it. */
  const setPaused = async (paused: boolean) => {
    const current = sessionRef.current;
    if (!current?.session) return;
    try {
      await navigationApi.update(current.session.id, { action: paused ? 'pause' : 'resume' });
    } catch {
      // The walk continues locally even if the pause never lands; the next position fix resynchronises it.
    }
  };

  const stopTracking = () => {
    subscription.current?.remove();
    subscription.current = null;
    setTracking(false);
  };

  const startTracking = async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Location', 'Allow location access while the app is open so the route can follow you.');
        return;
      }
      setTracking(true);
      subscription.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 4000, distanceInterval: 5 },
        (location: Location.LocationObject) => {
          const now = Date.now();
          if (now - lastPost.current < 3500) return;
          lastPost.current = now;
          void push({ latitude: location.coords.latitude, longitude: location.coords.longitude, accuracy: location.coords.accuracy });
        },
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Location tracking could not start.');
      setTracking(false);
    }
  };

  useEffect(() => () => subscription.current?.remove(), []);

  const complete = async () => {
    if (!session?.session) return;
    stopTracking();
    try {
      await navigationApi.complete(session.session.id);
      Alert.alert('Route finished', 'Session closed. Thanks for walking with CampusFlow.');
      router.back();
    } catch (caught) {
      Alert.alert('Route', caught instanceof ApiError ? (caught.firstError ?? caught.message) : 'Could not close the session.');
    }
  };

  const route: MobileRoute | undefined = session?.route ?? undefined;
  const liveNavigation = progress?.navigation;
  const currentStepIndex = liveNavigation?.current_step_index ?? 0;
  const currentStep = route?.steps?.[currentStepIndex];

  return (
    <Screen>
      <View style={styles.header}>
        <Eyebrow>Navigation</Eyebrow>
        <Title style={{ marginTop: 2 }}>{session?.destination_label ?? `Route to ${code}`}</Title>
        <Small style={{ marginTop: 4 }}>
          {route
            ? `${Math.round(route.distance_m)} m · about ${Math.max(1, Math.round(route.duration_s / 60))} min${route.uses_stairs ? ' · includes stairs' : ''}`
            : 'Indoor and outdoor routing computed by the API walking graph.'}
        </Small>
      </View>

      <View style={styles.padded}>
        {error ? <ErrorNote message={error} onRetry={() => void start()} /> : null}

        {!session ? (
          <Card>
            <H3>Plan the walk</H3>
            <Small style={{ marginTop: 4 }}>
              Use your current GPS position outdoors or scan a nearby QR anchor indoors. Turn on the step-free option to avoid stairs.
            </Small>
            <View style={styles.toggleRow}>
              <Button
                label={accessible ? 'Step-free route: on' : 'Step-free route: off'}
                variant={accessible ? 'primary' : 'secondary'}
                onPress={() => setAccessible((value) => !value)}
                style={{ flex: 1 }}
              />
            </View>
            <Button label="Start route" loading={busy} onPress={() => void start()} style={{ marginTop: spacing.md }} />
          </Card>
        ) : null}

        {busy && !session ? <Loading label="Computing the shortest walk…" /> : null}

        {route ? (
          <>
            <Card>
              <SectionTitle
                title="Following"
                action={<Badge tone={tracking ? 'mint' : 'neutral'}>{tracking ? 'live' : 'paused'}</Badge>}
              />
              <H2>{currentStep?.instruction ?? 'Start walking'}</H2>
              <Small style={{ marginTop: 4 }}>
                Step {Math.min(currentStepIndex + 1, route.steps?.length ?? 0)} of {route.steps?.length ?? 0}
                {currentStep?.floor_name ? ` · ${currentStep.floor_name}` : ''}
              </Small>
              <View style={{ marginTop: spacing.md }}>
                <ProgressBar value={liveNavigation?.progress ?? 0} tone="mint" />
              </View>
              <AdaptiveRow style={styles.stats}>
                <Stat label="Remaining" value={`${Math.round(liveNavigation?.remaining_m ?? route.distance_m)} m`} />
                <Stat label="From route" value={liveNavigation ? `${Math.round(liveNavigation.distance_from_route_m)} m` : '—'} tone={liveNavigation?.off_route ? 'signal' : 'neutral'} />
                <Stat label="Grace" value={liveNavigation?.grace_seconds_remaining ? countdown(liveNavigation.grace_seconds_remaining) : '—'} />
              </AdaptiveRow>

              {liveNavigation?.off_route ? (
                <Card style={{ marginTop: spacing.md, backgroundColor: colors.signal100, borderColor: colors.signal100 }}>
                  <Small style={{ color: colors.signal700, fontWeight: '700' }}>You seem to be off the route</Small>
                  <Small style={{ color: colors.signal700, marginTop: 2 }}>
                    Keep walking or follow the new route — CampusFlow recalculates automatically after the grace period and never cancels your journey.
                  </Small>
                </Card>
              ) : null}

              {liveNavigation?.recalculated ? (
                <Small style={{ marginTop: spacing.md, color: colors.brand700, fontWeight: '700' }}>Route recalculated from your nearest point.</Small>
              ) : null}

              <AdaptiveRow style={styles.actions}>
                {tracking ? (
                  <Button
                    label="Pause walk"
                    variant="secondary"
                    onPress={() => {
                      stopTracking();
                      void setPaused(true);
                    }}
                    style={{ flex: 1 }}
                  />
                ) : (
                  <Button
                    label="Resume walk"
                    onPress={() => {
                      void startTracking();
                      void setPaused(false);
                    }}
                    style={{ flex: 1 }}
                  />
                )}
                <Button label="Finish" variant="ghost" onPress={() => void complete()} style={{ flex: 1 }} />
              </AdaptiveRow>
            </Card>

            <RouteTrace legs={route.legs} originPosition={routeOrigin} position={currentPosition} originNode={route.origin?.node} />

            <Card style={{ marginTop: spacing.lg }}>
              <SectionTitle title="Steps" />
              {route.steps?.map((step, index) => (
                <View key={`${step.index}-${index}`} style={[styles.step, index === currentStepIndex ? styles.stepActive : null]}>
                  <Ionicons
                    name={step.kind === 'stairs' ? 'trending-up-outline' : step.kind === 'elevator' ? 'swap-vertical-outline' : 'arrow-forward-outline'}
                    size={16}
                    color={index === currentStepIndex ? colors.brand700 : colors.ink400}
                  />
                  <View style={{ flex: 1 }}>
                    <Small style={{ color: index === currentStepIndex ? colors.brand700 : colors.ink800, fontWeight: '600' }}>{step.instruction}</Small>
                    <Small>
                      {Math.round(step.distance_m)} m{step.floor_name ? ` · ${step.floor_name}` : ''}
                    </Small>
                  </View>
                </View>
              ))}
              <View style={{ marginTop: spacing.md }}>
                <KeyValue label="Origin" value={route.origin?.label ?? 'Unknown'} />
                <KeyValue label="Destination" value={route.destination?.label ?? 'Unknown'} />
                <KeyValue label="Accessible" value={route.accessible ? 'yes — step-free' : 'standard'} tone={route.accessible ? 'mint' : undefined} />
              </View>
            </Card>
          </>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { padding: spacing.lg },
  padded: { paddingHorizontal: spacing.lg },
  toggleRow: { flexDirection: 'row', marginTop: spacing.md },
  stats: { marginTop: spacing.md },
  actions: { marginTop: spacing.lg },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: 10 },
  stepActive: { backgroundColor: colors.brand50 },
});
