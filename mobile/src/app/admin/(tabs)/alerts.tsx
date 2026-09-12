import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Badge, Button, Card, EmptyState, ErrorNote, Eyebrow, Loading, Screen, Small, Title } from '@/components/ui';
import { ApiError, adminApi } from '@/lib/api';
import { useLoader } from '@/lib/auth';
import { formatClock, spacing } from '@/lib/theme';
import type { AdminAlert } from '@/lib/types';

const ORDER: Record<string, number> = { critical: 0, warning: 1, info: 2 };

/**
 * The alert feed — what an administrator is willing to look at on a small screen.
 *
 * These are not stored incidents someone filed: each one is derived from the campus as it stands right now
 * (a line past its own limit, a queue open for a room that is closed, a desk with nobody rostered but
 * tickets to serve, a QR code that has not been verified, a spike in failed scans). Acknowledging mutes the
 * fingerprint until the condition changes, which is why the button says "mute" rather than "resolve" — you
 * cannot fix any of them from here, and pretending otherwise on a phone would be a lie with a checkmark.
 */
export default function AdminAlertsScreen() {
  const router = useRouter();
  const feed = useLoader(() => adminApi.alerts(), []);
  const [busy, setBusy] = useState<string | null>(null);

  const acknowledge = async (alert: AdminAlert) => {
    setBusy(alert.key);
    try {
      await adminApi.acknowledge(alert.key, 'Acknowledged from the mobile app');
      feed.reload();
    } catch (caught) {
      Alert.alert('Alert', caught instanceof ApiError ? (caught.firstError ?? caught.message) : 'The alert could not be acknowledged.');
    } finally {
      setBusy(null);
    }
  };

  const alerts: AdminAlert[] = [...(feed.data?.alerts ?? [])].sort(
    (a, b) => (ORDER[a.severity] ?? 3) - (ORDER[b.severity] ?? 3),
  );
  const counts = feed.data?.counts;

  return (
    <Screen onRefresh={feed.reload} refreshing={feed.loading}>
      <View style={styles.header}>
        <Eyebrow>Alerts</Eyebrow>
        <Title style={{ marginTop: 2 }}>{alerts.length} open</Title>
        <Small style={{ marginTop: 4 }}>
          {counts ? `${counts.critical} critical · ${counts.warning} warning · generated ${formatClock(feed.data?.generated_at)}` : 'Reading live campus state…'}
        </Small>
      </View>

      {feed.error ? (
        <View style={styles.padded}>
          <ErrorNote message={feed.error} onRetry={feed.reload} />
        </View>
      ) : null}

      {feed.loading && !feed.data ? <Loading label="Deriving alerts…" /> : null}

      <View style={styles.padded}>
        {alerts.length === 0 && !feed.loading ? (
          <EmptyState
            title="Nothing is on fire"
            description="A queue past its limit, a closed desk with tickets open, or an unverified code would appear here the moment it is true."
          />
        ) : null}

        {alerts.map((alert) => (
          <Card key={alert.key} style={{ marginTop: spacing.md }}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Title style={{ fontSize: 16 }}>{alert.title}</Title>
                <Small style={{ marginTop: 4 }}>{alert.detail}</Small>
              </View>
              <Badge tone={alert.severity === 'critical' ? 'coral' : alert.severity === 'warning' ? 'signal' : 'neutral'}>
                {alert.severity}
              </Badge>
            </View>

            <Small style={{ marginTop: spacing.md, opacity: 0.75 }}>
              Fix it in the web console{alert.target ? ` · ${alert.target}` : ''}
            </Small>

            <View style={styles.actions}>
              <Button
                label="Mute this condition"
                variant="secondary"
                loading={busy === alert.key}
                onPress={() => void acknowledge(alert)}
                style={{ flex: 1 }}
              />
              <Button label="Details" variant="ghost" onPress={() => router.push(`/admin/alert/${encodeURIComponent(alert.key)}` as any)} style={{ flex: 1 }} />
            </View>
          </Card>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  padded: { paddingHorizontal: spacing.lg, marginTop: spacing.md, paddingBottom: spacing.xl },
  row: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
});
