import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Badge, Button, Card, EmptyState, ErrorNote, Eyebrow, H3, Loading, Screen, Small, Stat, Title } from '@/components/ui';
import { ApiError, staffApi } from '@/lib/api';
import { useAuth, useLoader } from '@/lib/auth';
import { formatClock, spacing } from '@/lib/theme';
import type { StaffMobileDashboard } from '@/lib/types';

/**
 * The staff member's own lines — the only dashboard a phone shows an operator.
 *
 * Every card answers "what is happening in front of me right now": who is at the counter, how long the
 * wait is, and the one action that moves the line forward. Capacity, windows, staffing and history are
 * deliberately not here; they are web console screens. The payload is already scoped server-side to the
 * rooms and desks this person owns, so an operator with nothing assigned sees an empty state, not the campus.
 */
export default function StaffLineHome() {
  const router = useRouter();
  const { signOut } = useAuth();
  const dashboard = useLoader(() => staffApi.dashboard(), []);
  const [busy, setBusy] = useState<string | null>(null);

  const act = useCallback(
    async (label: string, run: () => Promise<unknown>) => {
      setBusy(label);
      try {
        await run();
        dashboard.reload();
      } catch (caught) {
        Alert.alert('Line', caught instanceof ApiError ? (caught.firstError ?? caught.message) : 'That action could not be completed.');
      } finally {
        setBusy(null);
      }
    },
    [dashboard],
  );

  if (dashboard.loading && !dashboard.data) return <Loading label="Loading your lines…" />;

  const data: StaffMobileDashboard | undefined = dashboard.data ?? undefined;
  const queues = data?.queues ?? [];
  const offices = data?.offices ?? [];

  return (
    <Screen onRefresh={dashboard.reload} refreshing={dashboard.loading}>
      <View style={styles.header}>
        <Eyebrow>Operations · mobile</Eyebrow>
        <Title style={{ marginTop: 2 }}>My lines</Title>
        <Small style={{ marginTop: 4 }}>
          Call, check in and close. Anything you need to configure is on the web console.
        </Small>
      </View>

      {dashboard.error ? (
        <View style={styles.padded}>
          <ErrorNote message={dashboard.error} onRetry={dashboard.reload} />
        </View>
      ) : null}

      {data ? (
        <View style={[styles.padded, styles.kpis]}>
          <Stat label="Waiting now" value={data.kpis.waiting_now} tone={data.kpis.waiting_now > 0 ? 'signal' : 'neutral'} />
          <Stat label="Served today" value={data.kpis.served_today} tone="mint" />
          <Stat label="Desks open" value={data.kpis.offices_open} />
        </View>
      ) : null}

      <View style={styles.padded}>
        <H3>Room queues</H3>
        {queues.length === 0 ? (
          <Card style={{ marginTop: spacing.sm }}>
            <Small>No room queue is assigned to you. An administrator attaches rooms to your department before you can run a line.</Small>
          </Card>
        ) : (
          queues.map((queue) => (
            <Card key={queue.queue_id} style={{ marginTop: spacing.md }}>
              <View style={styles.cardHead}>
                <View style={{ flex: 1 }}>
                  <Title style={{ fontSize: 17 }}>{queue.room_code}</Title>
                  <Small>
                    {queue.building_code} · {queue.floor_name} · {queue.waiting} waiting
                  </Small>
                </View>
                <Badge tone={queue.is_active ? 'mint' : 'neutral'}>{queue.is_active ? 'open' : 'paused'}</Badge>
              </View>

              {queue.current ? (
                <View style={styles.current}>
                  <View style={{ flex: 1 }}>
                    <Small>Now serving</Small>
                    <Title style={{ fontSize: 15 }}>{queue.current.ticket_number}</Title>
                    <Small>{queue.current.student_name}</Small>
                  </View>
                  {queue.current.check_in_deadline ? (
                    <Badge tone="signal">due {formatClock(queue.current.check_in_deadline)}</Badge>
                  ) : null}
                </View>
              ) : (
                <Small style={{ marginTop: spacing.sm }}>Nobody is at the counter.</Small>
              )}

              <View style={styles.actions}>
                <Button
                  label="Call next"
                  loading={busy === `next-${queue.queue_id}`}
                  disabled={!queue.is_active || queue.waiting === 0}
                  onPress={() => void act(`next-${queue.queue_id}`, () => staffApi.callNext(queue.queue_id))}
                  style={{ flex: 1 }}
                />
                <Button
                  label="Open line"
                  variant="secondary"
                  onPress={() => router.push(`/staff/line/${queue.queue_id}` as any)}
                  style={{ flex: 1 }}
                />
              </View>
            </Card>
          ))
        )}

        <H3 style={{ marginTop: spacing.lg }}>Offices</H3>
        {offices.length === 0 ? (
          <Card style={{ marginTop: spacing.sm }}>
            <Small>You are not rostered at a service desk today.</Small>
          </Card>
        ) : (
          offices.map((office) => (
            <Card key={office.office_id} style={{ marginTop: spacing.md }}>
              <View style={styles.cardHead}>
                <View style={{ flex: 1 }}>
                  <Title style={{ fontSize: 17 }}>{office.name}</Title>
                  <Small>
                    {office.room_code ? `${office.room_code} · ` : ''}
                    {office.waiting} waiting · about {office.service_duration_minutes} min each
                  </Small>
                </View>
                <Badge tone={office.is_active ? 'mint' : 'coral'}>{office.is_active ? 'open' : 'closed'}</Badge>
              </View>
              <View style={styles.actions}>
                <Button
                  label="Call next"
                  loading={busy === `office-${office.office_id}`}
                  onPress={() => void act(`office-${office.office_id}`, () => staffApi.officeCallNext(office.office_id))}
                  style={{ flex: 1 }}
                />
                <Button label="Desk view" variant="secondary" onPress={() => router.push(`/staff/office/${office.office_id}` as any)} style={{ flex: 1 }} />
              </View>
            </Card>
          ))
        )}

        {queues.length === 0 && offices.length === 0 ? (
          <EmptyState title="Nothing to run" description="Your account is not attached to a room queue or a service desk yet." />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  padded: { paddingHorizontal: spacing.lg, marginTop: spacing.md },
  kpis: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  cardHead: { alignItems: 'center', flexDirection: 'row' },
  current: {
    alignItems: 'center',
    backgroundColor: '#f4f6ff',
    borderRadius: 12,
    flexDirection: 'row',
    marginTop: spacing.md,
    padding: spacing.md,
  },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
});
