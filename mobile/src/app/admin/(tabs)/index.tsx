import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { AdaptiveRow, Badge, Button, Card, ErrorNote, KeyValue, Loading, Screen, SectionTitle, Small, Stat } from '@/components/ui';
import { HeroPanel, IconTile, Notice, PageIntro } from '@/components/visual';
import { adminApi } from '@/lib/api';
import { useAuth, useLoader } from '@/lib/auth';
import { formatClock } from '@/lib/theme';

export default function AdminMonitoringScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const monitoring = useLoader(() => adminApi.monitoring(), []);
  const alerts = useLoader(() => adminApi.alerts(), []);
  const data = monitoring.data;
  const counts = alerts.data?.counts;

  return <Screen bottomSafeArea={false} onRefresh={() => { void monitoring.reload(); void alerts.reload(); }} refreshing={monitoring.loading || alerts.loading}>
    <PageIntro eyebrow="Administration · monitoring" title="Campus, at a glance." description="A clear view of the services keeping your campus moving." icon="analytics-outline" />
    <View style={{ paddingHorizontal: 20, gap: 20 }}>
      {monitoring.loading && !data ? <Loading label="Reading the campus…" /> : null}
      {monitoring.error ? <ErrorNote message={monitoring.error} onRetry={monitoring.reload} /> : null}
      {data ? <>
        <HeroPanel eyebrow={`Campus snapshot · ${formatClock(data.generated_at)}`} title={data.platform.unacknowledged_alerts > 0 ? `${data.platform.unacknowledged_alerts} alerts need review` : 'No unacknowledged alerts'} description="A snapshot of campus data. Pull to refresh for the latest service state." icon={data.platform.unacknowledged_alerts > 0 ? 'shield-outline' : 'shield-checkmark-outline'}>
          <Button label="Open alert centre" variant="secondary" onPress={() => router.push('/admin/alerts' as any)} />
        </HeroPanel>
        <AdaptiveRow><Stat label="Queues open" value={data.queues.open} tone="brand" /><Stat label="Desks open" value={data.offices.open} tone="mint" /></AdaptiveRow>
        <Card>
          <SectionTitle title="Room queues" action={<IconTile name="people-outline" size={38} />} />
          <AdaptiveRow><Stat label="Waiting now" value={data.queues.waiting_now} tone="signal" /><Stat label="Served today" value={data.queues.served_today} tone="mint" /></AdaptiveRow>
          <View style={{ marginTop: 16 }}><KeyValue label="Tickets issued today" value={data.queues.issued_today} /><KeyValue label="No-show rate" value={data.queues.no_show_rate_today === null ? 'No tickets issued yet' : `${Math.round(data.queues.no_show_rate_today * 100)}%`} /></View>
        </Card>
        <Card>
          <SectionTitle title="Service offices" action={<IconTile name="business-outline" tone="mint" size={38} />} />
          <AdaptiveRow><Stat label="Waiting now" value={data.offices.waiting_now} /><Stat label="Completed today" value={data.offices.completed_today} tone="mint" /></AdaptiveRow>
        </Card>
        <View>
          <SectionTitle title="Attention centre" action={counts ? <Badge tone={counts.critical > 0 ? 'coral' : 'brand'}>{counts.critical} critical</Badge> : undefined} />
          {alerts.error ? <ErrorNote message={alerts.error} onRetry={alerts.reload} /> : counts ? <Notice icon="notifications-outline" title={`${counts.critical} critical · ${counts.warning} warning`} tone={counts.critical > 0 ? 'coral' : counts.warning > 0 ? 'signal' : 'mint'}>Review each condition in Alerts. Acknowledging it does not resolve the underlying issue.</Notice> : <Loading label="Checking alerts…" />}
        </View>
        <Card><SectionTitle title="Across the platform" action={<IconTile name="grid-outline" size={34} />} /><KeyValue label="Active queues" value={data.platform.active_queues} /><KeyValue label="Walks today" value={data.platform.navigation_today} /><KeyValue label="Campus accounts" value={data.platform.users} /></Card>
      </> : null}
      <Notice icon="desktop-outline" title="Monitor here. Configure on the web.">Buildings, users, policies and campus setup remain in your administration console.</Notice>
      <Button label="Sign out of this device" variant="secondary" onPress={() => void signOut()} />
    </View>
  </Screen>;
}
