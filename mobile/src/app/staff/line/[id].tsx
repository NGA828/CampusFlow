import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Badge, Button, Card, EmptyState, ErrorNote, Eyebrow, H3, Loading, Screen, Small, Stat, Title } from '@/components/ui';
import { ApiError, staffApi } from '@/lib/api';
import { useLoader } from '@/lib/auth';
import { countdown, formatClock, spacing } from '@/lib/theme';
import type { StaffQueueLineRow } from '@/lib/types';

/**
 * One room line, worked from a phone.
 *
 * This screen exists because calling a ticket happens at the counter, not at a desk: the operator needs the
 * next name, who has been waiting longest, and the buttons that move a ticket forward. It carries no
 * configuration — capacity, windows, no-show grace and mode are set by an administrator on the web console
 * (`/admin/services`) — and the open/close switch is here because a sudden crowd is a corridor decision.
 *
 * The payload is scoped by the same rule as every other staff read: a queue in a room this person does not
 * own returns 403 `FORBIDDEN_FOR_PRINCIPAL`, so there is nothing to hide client-side.
 */
export default function StaffQueueLineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const line = useLoader(() => staffApi.queueLine(String(id)), [id]);
  const [busy, setBusy] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // Deadlines are relative, so the row re-renders on a timer instead of going stale between pulls.
  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  void tick;

  const run = async (label: string, action: () => Promise<unknown>) => {
    setBusy(label);
    try {
      await action();
      line.reload();
    } catch (caught) {
      Alert.alert('Line', caught instanceof ApiError ? (caught.firstError ?? caught.message) : 'That action could not be completed.');
    } finally {
      setBusy(null);
    }
  };

  if (line.loading && !line.data) return <Loading label="Opening the line…" />;

  const queue = line.data?.queue;
  const rows: StaffQueueLineRow[] = line.data?.line ?? [];
  const counts = line.data?.counts ?? { waiting: 0, called: 0, checked_in: 0 };

  return (
    <Screen onRefresh={line.reload} refreshing={line.loading}>
      <View style={styles.header}>
        <Eyebrow>{queue?.room_code ? `${queue.room_name} · ${queue.room_code}` : 'Room line'}</Eyebrow>
        <Title style={{ marginTop: 2 }}>The line</Title>
      </View>

      {line.error ? (
        <View style={styles.padded}>
          <ErrorNote message={line.error} onRetry={line.reload} />
        </View>
      ) : null}

      {queue ? (
        <View style={styles.padded}>
          <Card>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Small>
                  {queue.proximity_radius_m ? `Check in within ${queue.proximity_radius_m} m of the room` : 'No proximity requirement'} ·{' '}
                  {queue.avg_service_minutes ?? 6} min average
                </Small>
              </View>
              <Badge tone={queue.is_open ? 'mint' : 'coral'}>{queue.is_open ? 'open' : 'closed'}</Badge>
            </View>
            <View style={styles.stats}>
              <Stat label="Waiting" value={counts.waiting} />
              <Stat label="Called" value={counts.called} tone={counts.called > 0 ? 'signal' : 'neutral'} />
              <Stat label="Checked in" value={counts.checked_in} tone="mint" />
              <Stat label="In room" value={queue.current_count} hint={`of ${queue.capacity}`} />
            </View>
            <View style={styles.actions}>
              <Button
                label={queue.is_open ? 'Close line' : 'Open line'}
                variant={queue.is_open ? 'danger' : 'primary'}
                loading={busy === 'open'}
                onPress={() => void run('open', () => staffApi.setQueueOpen(queue.id, !queue.is_open))}
                style={{ flex: 1 }}
              />
              <Button
                label="Call next"
                variant="secondary"
                disabled={counts.waiting === 0 || !queue.is_open}
                loading={busy === 'next'}
                onPress={() => void run('next', () => staffApi.callNext(queue.id))}
                style={{ flex: 1 }}
              />
            </View>
          </Card>

          <H3 style={{ marginTop: spacing.lg }}>{rows.length} in line</H3>
          {rows.length === 0 ? <EmptyState title="Nobody is waiting" description="New tickets appear here as they are issued." /> : null}

          {rows.map((ticket) => (
            <Card key={ticket.id} style={{ marginTop: spacing.md }}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Title style={{ fontSize: 16 }}>{ticket.ticket_number}</Title>
                  <Small>
                    {ticket.user_name ?? 'Student'} · position {ticket.position}
                  </Small>
                </View>
                <Badge tone={ticket.status === 'checked_in' ? 'mint' : ticket.status === 'called' ? 'signal' : 'neutral'}>
                  {ticket.status.replace('_', ' ')}
                </Badge>
              </View>

              {ticket.status === 'called' && ticket.seconds_until_deadline !== null ? (
                <Small style={{ marginTop: spacing.sm, color: '#934c0b' }}>
                  Check-in window closes in {countdown(ticket.seconds_until_deadline)} — at {formatClock(ticket.check_in_deadline)}
                </Small>
              ) : null}

              <View style={styles.actions}>
                {ticket.status === 'waiting' ? (
                  <Button label="Call" onPress={() => void run(`call-${ticket.id}`, () => staffApi.callTicket(ticket.id))} style={{ flex: 1 }} />
                ) : null}
                {ticket.status === 'called' ? (
                  <Button
                    label="Check in"
                    variant="secondary"
                    loading={busy === `ci-${ticket.id}`}
                    onPress={() => void run(`ci-${ticket.id}`, () => staffApi.checkInTicket(ticket.id))}
                    style={{ flex: 1 }}
                  />
                ) : null}
                {ticket.status === 'checked_in' || ticket.status === 'called' ? (
                  <Button label="Admit" variant="secondary" loading={busy === `ad-${ticket.id}`} onPress={() => void run(`ad-${ticket.id}`, () => staffApi.admitTicket(ticket.id))} style={{ flex: 1 }} />
                ) : null}
                {ticket.status !== 'completed' ? (
                  <Button label="Complete" loading={busy === `done-${ticket.id}`} onPress={() => void run(`done-${ticket.id}`, () => staffApi.completeTicket(ticket.id))} style={{ flex: 1 }} />
                ) : null}
                {ticket.status === 'called' ? (
                  <Button label="No-show" variant="ghost" onPress={() => void run(`ns-${ticket.id}`, () => staffApi.noShowTicket(ticket.id))} style={{ flex: 1 }} />
                ) : null}
              </View>
            </Card>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  padded: { paddingHorizontal: spacing.lg, marginTop: spacing.md, paddingBottom: spacing.xl },
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
});
