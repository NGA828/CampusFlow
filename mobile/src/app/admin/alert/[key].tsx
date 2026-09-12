import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Badge, Button, Card, EmptyState, ErrorNote, Eyebrow, KeyValue, Loading, Screen, Small, Title } from '@/components/ui';
import { ApiError, adminApi } from '@/lib/api';
import { useLoader } from '@/lib/auth';
import { formatClock, spacing } from '@/lib/theme';

/**
 * One alert, opened from a push notification or the feed.
 *
 * The `key` is the fingerprint the server derives from live state, and it is what muting records — so this
 * screen is a read of the same derivation, never a second copy of the rules. If the alert is absent here,
 * the condition has already stopped being true, which is a better answer than a stale ticket with a
 * "resolved" button on it.
 */
export default function AdminAlertDetailScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const router = useRouter();
  const feed = useLoader(() => adminApi.alerts(), []);
  const [busy, setBusy] = useState(false);

  const fingerprint = decodeURIComponent(String(key ?? ''));
  const alert = (feed.data?.alerts ?? []).find((item) => item.key === fingerprint) ?? null;

  const acknowledge = async () => {
    setBusy(true);
    try {
      await adminApi.acknowledge(fingerprint, 'Acknowledged from the mobile app');
      router.replace('/admin/alerts');
    } catch (caught) {
      Alert.alert('Alert', caught instanceof ApiError ? (caught.firstError ?? caught.message) : 'The alert could not be acknowledged.');
    } finally {
      setBusy(false);
    }
  };

  if (feed.loading && !feed.data) return <Loading label="Looking it up…" />;

  return (
    <Screen onRefresh={feed.reload} refreshing={feed.loading}>
      <View style={styles.header}>
        <Eyebrow>Alert</Eyebrow>
        <Title style={{ marginTop: 2 }}>{alert ? alert.title : 'This alert is no longer firing'}</Title>
      </View>

      <View style={styles.padded}>
        {feed.error ? <ErrorNote message={feed.error} onRetry={feed.reload} /> : null}

        {alert ? (
          <Card>
            <Small>{alert.detail}</Small>
            <View style={{ marginTop: spacing.md }}>
              <KeyValue label="Severity" value={alert.severity} tone={alert.severity === 'critical' ? 'coral' : 'signal'} />
              <KeyValue label="Fingerprint" value={alert.key} />
              <KeyValue label="Checked at" value={formatClock(feed.data?.generated_at)} />
            </View>
            <Button label="Mute this condition" loading={busy} onPress={() => void acknowledge()} style={{ marginTop: spacing.md }} />
            <Small style={{ marginTop: spacing.sm }}>
              Muting hides this condition until the underlying state changes. It does not fix anything, and it
              is recorded with your name in the alert acknowledgements table.
            </Small>
          </Card>
        ) : (
          <EmptyState
            title="Nothing to acknowledge"
            description="The live campus no longer matches this alert. Either someone fixed it, or the condition was momentary."
          />
        )}

        {alert?.target ? (
          <Card style={{ marginTop: spacing.md }}>
            <Title style={{ fontSize: 16 }}>Where to fix it</Title>
            <Small style={{ marginTop: 4 }}>{alert.target}</Small>
            <Small style={{ marginTop: spacing.sm }}>
              That screen is a web console route. Nothing on this app can change a room, a queue policy or a
              schedule — by design, and enforced by the API rather than by the absence of a link.
            </Small>
          </Card>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  padded: { paddingHorizontal: spacing.lg, marginTop: spacing.md, paddingBottom: spacing.xl },
});
