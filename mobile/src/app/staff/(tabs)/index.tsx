import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { AdaptiveRow, Badge, Button, Card, EmptyState, ErrorNote, Eyebrow, H3, Loading, Screen, Small, Stat, Title } from '@/components/ui';
import { HeroPanel, IconTile, Notice, PageIntro } from '@/components/visual';
import { ApiError, staffApi } from '@/lib/api';
import { useAuth, useLoader } from '@/lib/auth';
import { colors, formatClock, spacing } from '@/lib/theme';
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
  const { user } = useAuth();
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



  const data: StaffMobileDashboard | undefined = dashboard.data ?? undefined;
  const queues = data?.queues ?? [];
  const offices = data?.offices ?? [];

  return (
    <Screen bottomSafeArea={false} onRefresh={dashboard.reload} refreshing={dashboard.loading}>
      <PageIntro eyebrow="Staff · service operations" title="Keep campus moving." description={`Welcome, ${user?.name?.split(' ')[0] ?? 'there'}. Your assigned lines and desks, all in one place.`} icon="pulse-outline" />
      {dashboard.loading && !dashboard.data ? <Loading label="Loading your lines…" /> : null}
      {dashboard.error ? (
        <View style={styles.padded}>
          <ErrorNote message={dashboard.error} onRetry={dashboard.reload} />
        </View>
      ) : null}

      {data ? <View style={styles.padded}>
        <HeroPanel eyebrow="Your service snapshot" title={`${data.kpis.waiting_now} people waiting`} description={`${data.kpis.served_today} served today. Every call keeps someone's campus day moving.`} icon="people-outline" />
        <AdaptiveRow style={{ marginTop: 14 }}>
          <Stat label="Served today" value={data.kpis.served_today} tone="mint" />
          <Stat label="Desks open" value={data.kpis.offices_open} />
        </AdaptiveRow>
      </View> : null}

      {data ? <View style={styles.padded}>
        <H3>Room queues</H3>
        {queues.length === 0 ? (
          <Card style={{ marginTop: spacing.sm }}>
            <Small>No room queue is assigned to you. An administrator attaches rooms to your department before you can run a line.</Small>
          </Card>
        ) : (
          queues.map((queue) => (
            <Card key={queue.queue_id} style={{ marginTop: spacing.md }}>
              <View style={styles.cardHead}>
                <IconTile name="business-outline" tone="mint" />
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
                    <Eyebrow>At the counter</Eyebrow>
                    <Title style={{ fontSize: 28, color: colors.brand700, marginTop: 6 }}>{queue.current.ticket_number}</Title>
                    <Small>{queue.current.student_name}</Small>
                  </View>
                  {queue.current.check_in_deadline ? (
                    <Badge tone="signal">due {formatClock(queue.current.check_in_deadline)}</Badge>
                  ) : null}
                </View>
              ) : (
                <Small style={{ marginTop: spacing.sm }}>Nobody is at the counter.</Small>
              )}

              <AdaptiveRow style={styles.actions}>
                <Button
                  label="Call next"
                  loading={busy === `next-${queue.queue_id}`}
                  disabled={busy !== null || !queue.is_active || queue.waiting === 0}
                  onPress={() => void act(`next-${queue.queue_id}`, () => staffApi.callNext(queue.queue_id))}
                  style={{ flex: 1 }}
                />
                <Button
                  label="Open line"
                  variant="secondary"
                  onPress={() => router.push(`/staff/line/${queue.queue_id}` as any)}
                  style={{ flex: 1 }}
                />
              </AdaptiveRow>
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
                <IconTile name="business-outline" tone="mint" />
                <View style={{ flex: 1 }}>
                  <Title style={{ fontSize: 17 }}>{office.name}</Title>
                  <Small>
                    {office.room_code ? `${office.room_code} · ` : ''}
                    {office.waiting} waiting · about {office.service_duration_minutes} min each
                  </Small>
                </View>
                <Badge tone={office.is_active ? 'mint' : 'coral'}>{office.is_active ? 'open' : 'closed'}</Badge>
              </View>
              <AdaptiveRow style={styles.actions}>
                <Button
                  label="Call next"
                  loading={busy === `office-${office.office_id}`}
                  disabled={busy !== null || !office.is_active || office.waiting === 0}
                  onPress={() => void act(`office-${office.office_id}`, () => staffApi.officeCallNext(office.office_id))}
                  style={{ flex: 1 }}
                />
                <Button label="Desk view" variant="secondary" onPress={() => router.push(`/staff/office/${office.office_id}` as any)} style={{ flex: 1 }} />
              </AdaptiveRow>
            </Card>
          ))
        )}

        {queues.length === 0 && offices.length === 0 ? (
          <EmptyState title="Nothing to run" description="Your account is not attached to a room queue or a service desk yet." />
        ) : null}
      </View> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  padded: { paddingHorizontal: 20, marginBottom: 22 },
  kpis: { marginTop: spacing.md },
  cardHead: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  current: {
    alignItems: 'center',
    backgroundColor: colors.brand50, borderLeftWidth: 3, borderLeftColor: colors.brand500,
    borderRadius: 18,
    flexDirection: 'row',
    marginTop: spacing.md,
    padding: spacing.md,
  },
  actions: { marginTop: spacing.md },
});
