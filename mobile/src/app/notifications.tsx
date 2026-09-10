import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { Badge, Button, Card, Eyebrow, H3, ListRow, Loading, Screen, Small, Title } from '@/components/ui';
import { meApi } from '@/lib/api';
import { useLoader } from '@/lib/auth';
import { colors, relativeTime, spacing } from '@/lib/theme';

const TONE: Record<string, 'brand' | 'mint' | 'signal' | 'coral' | 'neutral'> = {
  urgent: 'coral',
  high: 'signal',
  normal: 'neutral',
};

export default function NotificationsScreen() {
  const notifications = useLoader(() => meApi.notifications({ per_page: 40 }), []);
  const items = notifications.data?.items ?? [];
  const unread = items.filter((item) => item.read_at === null).length;

  const markRead = async (id: string) => {
    await meApi.readNotification(id);
    notifications.reload();
  };

  const markAll = async () => {
    await meApi.readAllNotifications();
    notifications.reload();
  };

  return (
    <Screen onRefresh={notifications.reload} refreshing={notifications.loading}>
      <View style={styles.header}>
        <Eyebrow>Notification centre</Eyebrow>
        <Title style={{ marginTop: 2 }}>Notifications</Title>
        <Small style={{ marginTop: 4 }}>
          {unread > 0 ? `${unread} unread` : 'You are all caught up'} · delivered in-app, over the websocket and as push where the device allows it
        </Small>
      </View>

      {notifications.loading && items.length === 0 ? <Loading label="Loading notifications…" /> : null}

      <View style={styles.padded}>
        {items.length > 0 && unread > 0 ? (
          <Button label="Mark all as read" variant="secondary" onPress={() => void markAll()} style={{ marginBottom: spacing.md }} />
        ) : null}

        {items.length === 0 && !notifications.loading ? (
          <Card>
            <H3>Nothing yet</H3>
            <Small style={{ marginTop: 4 }}>Class reminders, ticket calls and campus announcements will appear here.</Small>
          </Card>
        ) : null}

        {items.map((item) => (
          <Pressable key={item.id} onPress={() => (item.read_at ? undefined : void markRead(item.id))}>
            <Card style={{ marginBottom: spacing.md, borderColor: item.read_at ? colors.ink100 : colors.brand300 }}>
              <View style={styles.titleRow}>
                <View style={{ flex: 1 }}>
                  <H3>{item.title}</H3>
                  <Small style={{ marginTop: 2 }}>{relativeTime(item.created_at)}</Small>
                </View>
                {item.read_at === null ? <View style={styles.dot} accessibilityLabel="Unread" /> : null}
              </View>
              <Small style={{ marginTop: spacing.sm }}>{item.body}</Small>
              <View style={styles.footer}>
                <Badge tone={TONE[item.priority] ?? 'neutral'}>{item.type.replace(/_/g, ' ')}</Badge>
                {item.read_at === null ? (
                  <Pressable onPress={() => void markRead(item.id)} accessibilityRole="button">
                    <Small style={{ color: colors.brand700, fontWeight: '700' }}>Mark read</Small>
                  </Pressable>
                ) : (
                  <View style={styles.readRow}>
                    <Ionicons name="checkmark-done-outline" size={14} color={colors.ink400} />
                    <Small>read</Small>
                  </View>
                )}
              </View>
            </Card>
          </Pressable>
        ))}

        <ListRow>
          <Small>Delivered by the CampusFlow notification service</Small>
        </ListRow>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { padding: spacing.lg },
  padded: { paddingHorizontal: spacing.lg },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand500, marginTop: 6 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md },
  readRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
