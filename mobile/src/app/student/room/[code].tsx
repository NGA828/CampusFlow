import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { AdaptiveRow, Badge, Button, Card, ErrorNote, Eyebrow, H2, H3, KeyValue, Loading, Screen, SectionTitle, Small, Stat, Title } from '@/components/ui';
import { ApiError, campusApi, queueApi } from '@/lib/api';
import { useLoader } from '@/lib/auth';
import { colors, dayName, formatClock, spacing } from '@/lib/theme';

export default function RoomDetailScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const room = useLoader(() => campusApi.room(String(code)), [code]);
  const [busy, setBusy] = useState(false);

  const detail = room.data;
  const room_ = detail?.room;
  const availability = detail?.availability;

  const joinQueue = async () => {
    if (!room_) return;
    setBusy(true);
    try {
      // One call: the room is the thing the student is pointing at, and the server resolves its line.
      await queueApi.joinByRoom(room_.id);
      Alert.alert('Queue', `Ticket issued for ${room_.code}. Open the Queue tab to follow your position.`);
    } catch (caught) {
      Alert.alert('Queue', caught instanceof ApiError ? (caught.firstError ?? caught.message) : 'Could not join the queue.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen onRefresh={room.reload} refreshing={room.loading}>
      <View style={styles.header}>
        <Eyebrow>{room_?.room_type ?? 'Room'}</Eyebrow>
        <Title style={{ marginTop: 2 }}>{room_?.name ?? String(code)}</Title>
        <Small style={{ marginTop: 4 }}>
          {room_?.code} · {room_?.building_code ?? ''} {room_?.floor_name ?? ''} · {room_?.capacity ?? 0} seats
        </Small>
      </View>

      {room.error ? (
        <View style={styles.padded}>
          <ErrorNote message={room.error} onRetry={room.reload} />
        </View>
      ) : null}

      {room.loading && !detail ? <Loading label="Loading room…" /> : null}

      {detail && room_ && availability ? (
        <View style={styles.padded}>
          <Card>
            <SectionTitle
              title="Availability now"
              action={<Badge tone={availability.is_available_now ? 'mint' : 'coral'}>{availability.is_available_now ? 'free' : 'in use'}</Badge>}
            />
            <H3>{availability.headline}</H3>
            {availability.current_session ? (
              <Small style={{ marginTop: 4 }}>
                {availability.current_session.course_code} · {availability.current_session.course_title} until {formatClock(availability.current_session.ends_at)}
              </Small>
            ) : (
              <Small style={{ marginTop: 4 }}>No teaching session right now.</Small>
            )}
            <AdaptiveRow style={styles.stats}>
              <Stat label="Open" value={availability.is_open ? 'yes' : 'no'} />
              <Stat label="Next free" value={availability.next_free_at ? formatClock(availability.next_free_at) : 'now'} />
              <Stat label="In room" value={availability.occupancy ? `${availability.occupancy.inside}/${availability.occupancy.capacity}` : 'no counter'} />
            </AdaptiveRow>
            <AdaptiveRow style={styles.actions}>
              <Button label="Navigate here" onPress={() => router.push(`/student/navigate/${encodeURIComponent(room_.code)}` as any)} style={{ flex: 1 }} />
              {room_.requires_admission ? <Button label="Join queue" variant="secondary" loading={busy} onPress={() => void joinQueue()} style={{ flex: 1 }} /> : null}
            </AdaptiveRow>
          </Card>

          {availability.free_slots.length > 0 ? (
            <Card style={{ marginTop: spacing.lg }}>
              <SectionTitle title="Free slots today" />
              {availability.free_slots.slice(0, 6).map((slot) => (
                <KeyValue key={slot.starts_at} label={`${formatClock(slot.starts_at)} – ${formatClock(slot.ends_at)}`} value="free" tone="mint" />
              ))}
            </Card>
          ) : null}

          {detail.week.length > 0 ? (
            <Card style={{ marginTop: spacing.lg }}>
              <SectionTitle title="This week" />
              {detail.week.slice(0, 10).map((session, index) => (
                <View key={`${session.course_code}-${index}`} style={styles.weekRow}>
                  <Small style={styles.weekDay}>{dayName(session.day_of_week).slice(0, 3)}</Small>
                  <View style={{ flex: 1 }}>
                    <Small style={{ color: colors.ink800, fontWeight: '600' }}>{session.course_code}</Small>
                    <Small>{session.course_title}</Small>
                  </View>
                  <Small>
                    {formatClock(session.starts_at)}–{formatClock(session.ends_at)}
                  </Small>
                </View>
              ))}
            </Card>
          ) : null}

          {room_.amenities.length > 0 || room_.accessibility.length > 0 ? (
            <Card style={{ marginTop: spacing.lg }}>
              <SectionTitle title="Features" />
              <View style={styles.tags}>
                {[...room_.amenities, ...room_.accessibility].map((tag) => (
                  <Badge key={tag}>{tag.replace(/_/g, ' ')}</Badge>
                ))}
              </View>
            </Card>
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { padding: spacing.lg },
  padded: { paddingHorizontal: spacing.lg },
  stats: { marginTop: spacing.md },
  actions: { marginTop: spacing.lg },
  weekRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  weekDay: { width: 34 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
