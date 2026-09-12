import { StyleSheet, View } from 'react-native';

import { Badge, Button, Card, EmptyState, Eyebrow, H3, KeyValue, Loading, Screen, SectionTitle, Small, Title } from '@/components/ui';
import { accountApi } from '@/lib/api';
import { useAuth, useLoader } from '@/lib/auth';
import { relativeTime, spacing } from '@/lib/theme';

/**
 * The staff "More" tab: your session, and the notification list you are owed as a person.
 *
 * This is where the platform split is stated out loud rather than implied by missing links. A phone is
 * given the notification centre because it is the same `/me/notifications` a student sees — the feed is a
 * fact about the user, not about the role — and it is *not* given accounts, room geometry, floor plans,
 * queue policy or analytics, because those are console work and the API treats them as web-platform routes.
 */
export default function StaffMoreScreen() {
  const { user, signOut } = useAuth();
  const notifications = useLoader(() => accountApi.notifications({ per_page: 25 }), []);

  const items = notifications.data?.items ?? [];

  return (
    <Screen onRefresh={notifications.reload} refreshing={notifications.loading}>
      <View style={styles.header}>
        <Eyebrow>Account</Eyebrow>
        <Title style={{ marginTop: 2 }}>{user?.name ?? 'Member of staff'}</Title>
      </View>

      <View style={styles.padded}>
        <Card>
          <KeyValue label="Email" value={user?.email ?? '—'} />
          <KeyValue label="Department" value={user?.department ?? 'Not set'} />
          <KeyValue label="Role" value={user?.role_code ?? 'staff'} />
          <Small style={{ marginTop: spacing.md }}>
            Timetable, events, announcements, service windows and analytics are edited from the web console
            at /staff — the mobile app deliberately has no forms for them.
          </Small>
        </Card>

        <SectionTitle
          title="Notifications"
          action={notifications.data?.unread ? <Badge tone="signal">{notifications.data.unread}</Badge> : undefined}
        />
        {notifications.loading && !notifications.data ? <Loading label="Loading…" /> : null}
        {items.length === 0 && !notifications.loading ? (
          <EmptyState title="Nothing new" description="Ticket calls and desk assignments reach you here and as a push notification." />
        ) : null}
        {items.map((item) => (
          <Card key={item.id} style={{ marginTop: spacing.sm }}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <H3>{item.title}</H3>
                <Small>{item.body}</Small>
                <Small style={{ marginTop: 4, opacity: 0.7 }}>{relativeTime(item.created_at)}</Small>
              </View>
              {item.read_at ? null : <Badge tone="brand">new</Badge>}
            </View>
          </Card>
        ))}
        {items.length > 0 ? (
          <Button label="Mark all as read" variant="secondary" onPress={() => void accountApi.readAllNotifications().then(notifications.reload)} style={{ marginTop: spacing.md }} />
        ) : null}

        <Button label="Sign out" variant="danger" onPress={() => void signOut()} style={{ marginTop: spacing.lg }} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  padded: { paddingHorizontal: spacing.lg, marginTop: spacing.md, paddingBottom: spacing.xl },
  row: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm },
});
