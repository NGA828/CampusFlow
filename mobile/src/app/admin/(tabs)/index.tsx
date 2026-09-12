import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Badge, Button, Card, ErrorNote, Eyebrow, H3, KeyValue, Loading, Screen, Small, Stat, Title } from '@/components/ui';
import { adminApi } from '@/lib/api';
import { useAuth, useLoader } from '@/lib/auth';
import { formatClock, spacing } from '@/lib/theme';

/**
 * Monitoring, sized for a glance.
 *
 * The numbers here are read live from the same tables the console edits — open lines, people waiting,
 * tickets served today, the no-show rate the last sweep produced — so a phone and a laptop can never show
 * two different truths. There is no "create room" shortcut and no user table: those actions are web-scoped
 * by policy, and a summary is the most this client is offered.
 */
export default function AdminMonitoringScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const monitoring = useLoader(() => adminApi.monitoring(), []);
  const alerts = useLoader(() => adminApi.alerts(), []);

  if (monitoring.loading && !monitoring.data) return <Loading label="Reading the campus…" />;

  const data = monitoring.data;
  const firing = alerts.data?.alerts ?? [];
  const counts = alerts.data?.counts ?? { critical: 0, warning: 0, acknowledged: 0 };

  return (
    <Screen
      onRefresh={() => {
        monitoring.reload();
        alerts.reload();
      }}
      refreshing={monitoring.loading}
    >
      <View style={styles.header}>
        <Eyebrow>Administration · mobile</Eyebrow>
        <Title style={{ marginTop: 2 }}>{data ? 'Campus is running' : 'Campus'}</Title>
        <Small style={{ marginTop: 4 }}>
          {user?.name ?? 'Administrator'} · read at {data ? formatClock(data.generated_at) : '—'}
        </Small>
      </View>

      {monitoring.error ? (
        <View style={styles.padded}>
          <ErrorNote message={monitoring.error} onRetry={monitoring.reload} />
        </View>
      ) : null}

      {data ? (
        <View style={styles.padded}>
          <Card>
            <H3>Room queues</H3>
            <View style={styles.stats}>
              <Stat label="Open lines" value={data.queues.open} />
              <Stat label="Waiting now" value={data.queues.waiting_now} tone={data.queues.waiting_now > 40 ? 'signal' : 'neutral'} />
              <Stat label="Issued today" value={data.queues.issued_today} />
              <Stat label="Served today" value={data.queues.served_today} tone="mint" />
            </View>
            {data.queues.no_show_rate_today !== null ? (
              <Small style={{ marginTop: spacing.sm }}>
                No-show rate today: {Math.round(data.queues.no_show_rate_today * 100)}% of tickets issued.
              </Small>
            ) : (
              <Small style={{ marginTop: spacing.sm }}>No tickets issued yet today, so there is no no-show rate to report.</Small>
            )}
          </Card>

          <Card style={{ marginTop: spacing.md }}>
            <H3>Service offices</H3>
            <View style={styles.stats}>
              <Stat label="Desks open" value={data.offices.open} />
              <Stat label="Waiting now" value={data.offices.waiting_now} />
              <Stat label="Completed today" value={data.offices.completed_today} tone="mint" />
            </View>
          </Card>

          <Card style={{ marginTop: spacing.md }}>
            <H3>Platform</H3>
            <KeyValue label="Active queues" value={data.platform.active_queues} />
            <KeyValue label="Walks today" value={data.platform.navigation_today} />
            <KeyValue label="Accounts" value={data.platform.users} />
            <KeyValue
              label="Unacknowledged alerts"
              value={data.platform.unacknowledged_alerts}
              tone={data.platform.unacknowledged_alerts > 0 ? 'coral' : 'mint'}
            />
          </Card>

          <View style={{ marginTop: spacing.md }}>
            <Card style={styles.alerts}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Title style={{ fontSize: 16 }}>{firing.length} thing{firing.length === 1 ? '' : 's'} need attention</Title>
                  <Small>
                    {counts.critical} critical · {counts.warning} warning
                  </Small>
                </View>
                <Badge tone={counts.critical > 0 ? 'coral' : counts.warning > 0 ? 'signal' : 'mint'}>
                  {counts.critical > 0 ? 'critical' : counts.warning > 0 ? 'watch' : 'clear'}
                </Badge>
              </View>
              <View style={styles.actions}>
                <Button label="Read and acknowledge" onPress={() => router.push('/admin/alerts' as any)} />
                <Small style={{ marginTop: spacing.sm }}>Each alert names the console screen that fixes it.</Small>
              </View>
            </Card>
          </View>

          <Small style={{ marginTop: spacing.lg }}>
            Configuration lives on the web console — open /admin on a computer to change rooms, plans, geofences, queue policy, users or roles.
          </Small>

          <View style={{ marginTop: spacing.lg }}>
            <Button label="Sign out of this device" variant="danger" onPress={() => void signOut()} />
            <Small style={{ marginTop: spacing.sm }}>The token is revoked on the server, not just cleared from the phone.</Small>
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  padded: { paddingHorizontal: spacing.lg, marginTop: spacing.md, paddingBottom: spacing.xl },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.md },
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  actions: { marginTop: spacing.md },
  alerts: { backgroundColor: '#fff8ec' },
});
