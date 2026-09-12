import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Badge, Button, Card, ErrorNote, Eyebrow, H2, H3, KeyValue, Loading, Screen, SectionTitle, Small, Stat, Title } from '@/components/ui';
import { ApiError, queueApi, studentApi } from '@/lib/api';
import { useLoader } from '@/lib/auth';
import { colors, countdown, formatClock, spacing } from '@/lib/theme';
import type { QueueTicketView } from '@/lib/types';

export default function QueueScreen() {
  const router = useRouter();
  const queues = useLoader(() => queueApi.list(), []);
  const ticket = useLoader(() => studentApi.activeQueueTicket(), []);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [ticker, setTicker] = useState(0);

  const active: QueueTicketView | null = ticket.data?.ticket ?? null;

  // Recompute the countdown every second so "check in before" is always current.
  useEffect(() => {
    if (!active?.seconds_until_deadline) return;
    const timer = setInterval(() => setTicker((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [active?.seconds_until_deadline]);

  void ticker;

  /** A join attempt carries the best position fix we can get; the API still validates the geofence. */
  const fix = useCallback(async (): Promise<Record<string, unknown> | undefined> => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') return undefined;
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      return { lat: location.coords.latitude, lng: location.coords.longitude, accuracy_m: location.coords.accuracy, source: 'gps' };
    } catch {
      return undefined;
    }
  }, []);

  const join = async (queueId: string) => {
    setBusyId(queueId);
    setNotice(null);
    try {
      const locationFix = await fix();
      await queueApi.join(queueId, locationFix ? { fix: locationFix } : {});
      setNotice('Ticket issued. Keep an eye on your position — it updates live.');
      ticket.reload();
      queues.reload();
    } catch (caught) {
      const message = caught instanceof ApiError ? (caught.firstError ?? caught.message) : 'Could not join the queue.';
      Alert.alert('Queue', message);
    } finally {
      setBusyId(null);
    }
  };

  const checkIn = async () => {
    if (!active) return;
    setBusyId(active.ticket.id);
    try {
      const locationFix = await fix();
      await queueApi.checkIn(active.ticket.id, locationFix ? { fix: locationFix } : {});
      setNotice('Checked in — the operator can see you are here.');
      ticket.reload();
    } catch (caught) {
      Alert.alert('Check-in', caught instanceof ApiError ? (caught.firstError ?? caught.message) : 'Check-in failed.');
    } finally {
      setBusyId(null);
    }
  };

  const cancel = async () => {
    if (!active) return;
    setBusyId(active.ticket.id);
    try {
      await queueApi.cancel(active.ticket.id);
      setNotice('Ticket cancelled — the place went to the next person.');
      ticket.reload();
      queues.reload();
    } catch (caught) {
      Alert.alert('Cancel', caught instanceof ApiError ? (caught.firstError ?? caught.message) : 'Cancel failed.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Screen onRefresh={() => { void ticket.reload(); void queues.reload(); }} refreshing={ticket.loading || queues.loading}>
      <View style={styles.header}>
        <Eyebrow>Room admission</Eyebrow>
        <Title style={{ marginTop: 2 }}>Queues</Title>
        <Small style={{ marginTop: 4 }}>Join from anywhere, then check in when you are physically at the room.</Small>
      </View>

      {notice ? (
        <View style={styles.padded}>
          <Card style={{ backgroundColor: colors.mint100, borderColor: colors.mint100 }}>
            <Small style={{ color: colors.mint700, fontWeight: '600' }}>{notice}</Small>
          </Card>
        </View>
      ) : null}

      {ticket.error ? (
        <View style={styles.padded}>
          <ErrorNote message={ticket.error} onRetry={ticket.reload} />
        </View>
      ) : null}

      {active ? (
        <View style={styles.padded}>
          <Card style={{ borderColor: colors.brand300 }}>
            <SectionTitle title="Your ticket" action={<Badge tone="brand">{active.ticket.status}</Badge>} />
            <H2 style={{ letterSpacing: 1 }}>{active.ticket.ticket_number}</H2>
            <Small style={{ marginTop: 4 }}>
              {active.queue.room_code} · {active.queue.room_name} · {active.queue.building_code ?? ''} {active.queue.floor_name ?? ''}
            </Small>

            <View style={styles.stats}>
              <Stat label="People ahead" value={active.people_ahead} tone="brand" />
              <Stat label="Wait" value={countdown(active.eta_seconds)} tone="mint" />
            </View>

            <View style={{ marginTop: spacing.md }}>
              <KeyValue label="Expected service" value={formatClock(active.expected_service_at)} />
              <KeyValue
                label="Check-in closes"
                value={active.seconds_until_deadline === null ? 'Not called yet' : countdown(active.seconds_until_deadline)}
                tone={active.seconds_until_deadline !== null && active.seconds_until_deadline < 120 ? 'coral' : undefined}
              />
              <KeyValue label="Serving now" value={active.counts.in_service} />
            </View>

            <View style={styles.actions}>
              <Button
                label={active.can_check_in ? 'Check in' : 'Check in (not yet called)'}
                onPress={() => void checkIn()}
                disabled={!active.can_check_in}
                loading={busyId === active.ticket.id}
                style={{ flex: 1 }}
              />
              <Button label="Navigate" variant="secondary" onPress={() => router.push(`/student/navigate/${encodeURIComponent(active.queue.room_code ?? '')}` as any)} style={{ flex: 1 }} />
            </View>
            {active.can_cancel ? (
              <Button label="Cancel ticket" variant="ghost" onPress={() => void cancel()} style={{ marginTop: spacing.sm }} />
            ) : null}
          </Card>
        </View>
      ) : null}

      {queues.error ? (
        <View style={styles.padded}>
          <ErrorNote message={queues.error} onRetry={queues.reload} />
        </View>
      ) : null}

      {queues.loading && !queues.data ? <Loading label="Loading queues…" /> : null}

      {queues.data?.queues.length === 0 ? (
        <View style={styles.padded}>
          <Card>
            <H3>No queues are open</H3>
            <Small style={{ marginTop: 4 }}>Admission queues appear here when staff open them for a room.</Small>
          </Card>
        </View>
      ) : null}

      <View style={styles.padded}>
        {queues.data?.queues.map((queue) => {
          const mine = queue.my_ticket_id !== null;
          return (
            <Card key={queue.id} style={{ marginBottom: spacing.md }}>
              <SectionTitle
                title={`${queue.building_code} · ${queue.room_code}`}
                action={<Badge tone={queue.is_active ? 'mint' : 'neutral'}>{queue.is_active ? 'open' : 'paused'}</Badge>}
              />
              <Small>{queue.room_name}</Small>
              <View style={styles.stats}>
                <Stat label="Waiting" value={queue.waiting} />
                <Stat label="Serving" value={queue.serving} />
                <Stat label="Avg service" value={`${Math.round(queue.avg_service_seconds / 60)}m`} />
              </View>
              <Small style={{ marginTop: spacing.sm }}>
                {queue.requires_proximity_to_join ? `Join within ${queue.proximity_radius_m} m` : 'Join from anywhere'}
                {queue.max_capacity ? ` · up to ${queue.max_capacity} in line` : ''}
              </Small>
              <Button
                label={mine ? 'You already hold a ticket' : 'Join queue'}
                disabled={mine || !queue.is_active}
                loading={busyId === queue.id}
                onPress={() => void join(queue.id)}
                style={{ marginTop: spacing.md }}
              />
            </Card>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { padding: spacing.lg },
  padded: { paddingHorizontal: spacing.lg },
  stats: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
});
