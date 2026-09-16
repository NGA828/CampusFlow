import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AdaptiveRow, Badge, Button, Card, EmptyState, ErrorNote, H3, Loading, Screen, Small } from '@/components/ui';
import { IconTile, Notice, PageIntro } from '@/components/visual';
import { ApiError, adminApi } from '@/lib/api';
import { useLoader } from '@/lib/auth';
import { colors, formatClock } from '@/lib/theme';
import type { AdminAlert } from '@/lib/types';

const ORDER: Record<string, number> = { critical: 0, warning: 1, info: 2 };
const FILTERS = ['all', 'critical', 'warning', 'info'] as const;

export default function AdminAlertsScreen() {
  const router = useRouter();
  const feed = useLoader(() => adminApi.alerts(), []);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<typeof FILTERS[number]>('all');
  const acknowledge = async (alert: AdminAlert) => {
    if (busy) return;
    setBusy(alert.key); setError(null);
    try { await adminApi.acknowledge(alert.key, 'Acknowledged from the mobile app'); await feed.reload(); }
    catch (caught) { setError(caught instanceof ApiError ? (caught.firstError ?? caught.message) : 'The alert could not be acknowledged.'); }
    finally { setBusy(null); }
  };
  const all = [...(feed.data?.alerts ?? [])].sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
  const visible = all.filter((alert) => filter === 'all' || alert.severity === filter);

  return <Screen bottomSafeArea={false} onRefresh={feed.reload} refreshing={feed.loading}>
    <PageIntro eyebrow="Administration · attention centre" title="Know what needs you." description={feed.data ? `${all.length} conditions reported · updated ${formatClock(feed.data.generated_at)}` : 'Review campus conditions and acknowledge what you have seen.'} icon="notifications-outline" />
    <View style={{ paddingHorizontal: 20, gap: 18 }}>
      <Notice icon="shield-checkmark-outline" title="An acknowledgement, not a resolution">Muting a condition records that you've seen it. Fix the underlying issue in the web console.</Notice>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {FILTERS.map((item) => <Pressable key={item} accessibilityRole="button" accessibilityLabel={`${item} alerts`} accessibilityState={{ selected: item === filter }} onPress={() => setFilter(item)} style={({ pressed }) => ({ minHeight: 46, paddingHorizontal: 16, paddingVertical: 12, justifyContent: 'center', borderRadius: 16, borderWidth: 1, borderColor: item === filter ? colors.ink900 : colors.ink200, backgroundColor: item === filter ? colors.ink900 : colors.white, opacity: pressed ? .8 : 1 })}><Text style={{ color: item === filter ? colors.white : colors.ink600, fontSize: 13, fontWeight: '600', textTransform: 'capitalize' }}>{item === 'all' ? 'All conditions' : item}</Text></Pressable>)}
      </View>
      {feed.error ? <ErrorNote message={feed.error} onRetry={feed.reload} /> : null}
      {error ? <ErrorNote message={error} /> : null}
      {feed.loading && !feed.data ? <Loading label="Checking campus conditions…" /> : null}
      {!feed.error && feed.data && visible.length === 0 ? <EmptyState title={filter === 'all' ? 'No conditions to review' : `No ${filter} conditions`} description="This view reflects the latest campus snapshot. Pull to refresh when you need an update." /> : null}
      {visible.map((alert) => {
        const tone = alert.severity === 'critical' ? 'coral' : alert.severity === 'warning' ? 'signal' : 'brand';
        return <Card key={alert.key} style={{ borderTopWidth: 3, borderTopColor: tone === 'coral' ? colors.coral500 : tone === 'signal' ? colors.signal400 : colors.brand500 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16 }}><IconTile name={tone === 'coral' ? 'warning-outline' : tone === 'signal' ? 'alert-circle-outline' : 'information-circle-outline'} tone={tone} size={42} /><Badge tone={tone}>{alert.severity}</Badge></View>
          <H3 style={{ fontSize: 19, lineHeight: 26 }}>{alert.title}</H3><Small style={{ marginTop: 8, lineHeight: 21 }}>{alert.detail}</Small>
          {alert.target ? <View style={{ backgroundColor: colors.ink50, padding: 12, borderRadius: 14, marginTop: 16 }}><Small>Web console · {alert.target}</Small></View> : null}
          <AdaptiveRow style={{ marginTop: 18 }}>
            <Button label="Mute this condition" variant="secondary" disabled={busy !== null} loading={busy === alert.key} onPress={() => void acknowledge(alert)} />
            <Button label="Details" variant="ghost" onPress={() => router.push(`/admin/alert/${encodeURIComponent(alert.key)}` as any)} />
          </AdaptiveRow>
        </Card>;
      })}
    </View>
  </Screen>;
}
