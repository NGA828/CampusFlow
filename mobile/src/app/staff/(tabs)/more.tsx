import { useState } from 'react';
import { View } from 'react-native';
import { Badge, Button, Card, EmptyState, ErrorNote, H3, KeyValue, Loading, Screen, SectionTitle, Small } from '@/components/ui';
import { IconTile, Notice, PageIntro, ProfileCard } from '@/components/visual';
import { ApiError, accountApi } from '@/lib/api';
import { useAuth, useLoader } from '@/lib/auth';
import { relativeTime } from '@/lib/theme';

export default function StaffMoreScreen() {
  const { user, signOut } = useAuth();
  const notifications = useLoader(() => accountApi.notifications({ per_page: 25 }), []);
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const items = notifications.data?.items ?? [];
  const markRead = async () => {
    if (reading) return;
    setReading(true); setReadError(null);
    try { await accountApi.readAllNotifications(); await notifications.reload(); }
    catch (error) { setReadError(error instanceof ApiError ? error.message : 'Could not update your notifications. Try again.'); }
    finally { setReading(false); }
  };
  return <Screen bottomSafeArea={false} onRefresh={notifications.reload} refreshing={notifications.loading}>
    <PageIntro eyebrow="Staff · your workspace" title="The person behind the desk." icon="person-circle-outline" />
    <View style={{ paddingHorizontal: 20, gap: 22 }}>
      <ProfileCard name={user?.name ?? 'Member of staff'} email={user?.email ?? ''} role="staff" />
      <Card><SectionTitle title="Your campus details" action={<IconTile name="id-card-outline" tone="mint" size={34} />} /><KeyValue label="Department" value={user?.department ?? 'Not set'} /><KeyValue label="Role" value={user?.role_code ?? 'staff'} /></Card>
      <Notice icon="desktop-outline" title="The right tools, in the right place" tone="mint">Run your desk here. Use the web console for timetables, content, service windows and analytics.</Notice>
      <View>
        <SectionTitle title="Your inbox" action={notifications.data ? <Badge tone="brand">{notifications.data.unread} unread</Badge> : undefined} />
        {notifications.loading && !notifications.data ? <Loading label="Loading your updates…" /> : null}
        {notifications.error ? <ErrorNote message={notifications.error} onRetry={notifications.reload} /> : null}
        {!notifications.error && notifications.data && items.length === 0 ? <EmptyState title="You're all caught up" description="Ticket calls and desk assignments will appear here." /> : null}
        {items.map((item) => <Card key={item.id} style={{ marginBottom: 12 }}><View style={{ flexDirection: 'row', gap: 12 }}><IconTile name={item.read_at ? 'mail-open-outline' : 'mail-unread-outline'} size={38} /><View style={{ flex: 1 }}><H3>{item.title}</H3><Small style={{ marginTop: 6 }}>{item.body}</Small><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, alignItems: 'center' }}><Small>{relativeTime(item.created_at)}</Small>{!item.read_at ? <Badge tone="brand">New</Badge> : null}</View></View></View></Card>)}
        {readError ? <ErrorNote message={readError} onRetry={() => void markRead()} /> : null}
        {items.length > 0 ? <Button label="Mark all as read" variant="secondary" loading={reading} onPress={() => void markRead()} /> : null}
      </View>
      <Button label="Sign out" variant="secondary" onPress={() => void signOut()} />
      <Small style={{ textAlign: 'center' }}>CampusFlow · Staff workspace</Small>
    </View>
  </Screen>;
}
