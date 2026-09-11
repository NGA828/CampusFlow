import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Badge, Card, ErrorNote, Eyebrow, H3, Loading, Screen, Small, Title } from '@/components/ui';
import { meApi } from '@/lib/api';
import { useLoader } from '@/lib/auth';
import { colors, dayName, formatClock, spacing } from '@/lib/theme';

export default function TimetableScreen() {
  const router = useRouter();
  const timetable = useLoader(() => meApi.timetable(), []);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const entries = timetable.data?.entries ?? [];

  const days = useMemo(() => {
    const present = new Set(entries.map((entry) => entry.day_of_week));
    return [1, 2, 3, 4, 5, 6, 7].filter((day) => present.has(day));
  }, [entries]);

  const activeDay = selectedDay ?? days[0] ?? new Date().getDay();
  const dayEntries = entries
    .filter((entry) => entry.day_of_week === activeDay)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  return (
    <Screen onRefresh={timetable.reload} refreshing={timetable.loading}>
      <View style={styles.header}>
        <Eyebrow>Personal timetable</Eyebrow>
        <Title style={{ marginTop: 2 }}>Your week</Title>
        <Small style={{ marginTop: 4 }}>
          {timetable.data?.term ? `${timetable.data.term} · derived from your enrolments` : 'Derived from your course enrolments'}
        </Small>
      </View>

      {timetable.error ? (
        <View style={styles.padded}>
          <ErrorNote message={timetable.error} onRetry={timetable.reload} />
        </View>
      ) : null}

      {timetable.loading && entries.length === 0 ? <Loading label="Loading your timetable…" /> : null}

      {days.length > 0 ? (
        <View style={styles.dayStrip}>
          {days.map((day) => {
            const active = day === activeDay;
            const count = entries.filter((entry) => entry.day_of_week === day).length;
            return (
              <Pressable
                key={day}
                onPress={() => setSelectedDay(day)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                style={[styles.dayChip, active ? { backgroundColor: colors.brand600, borderColor: colors.brand600 } : null]}
              >
                <Small style={{ color: active ? colors.white : colors.ink600, fontWeight: '600' }}>{dayName(day).slice(0, 3)}</Small>
                <Small style={{ color: active ? '#dfe4ff' : colors.ink400 }}>{count}</Small>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {!timetable.loading && entries.length === 0 ? (
        <View style={styles.padded}>
          <Card>
            <H3>No sessions this week</H3>
            <Small style={{ marginTop: 4 }}>
              Once you are enrolled in courses with published sessions they appear here automatically.
            </Small>
          </Card>
        </View>
      ) : null}

      <View style={styles.padded}>
        {dayEntries.map((entry) => (
          <Card key={entry.id} style={{ marginBottom: spacing.md }}>
            <View style={styles.cardHeader}>
              <Small style={{ fontWeight: '700', color: colors.ink700 }}>
                {formatClock(entry.starts_at_iso)} – {formatClock(entry.ends_at_iso)}
              </Small>
              <View style={styles.badges}>
                {entry.is_now ? <Badge tone="mint">now</Badge> : null}
                {entry.is_next ? <Badge tone="brand">next</Badge> : null}
                <Badge>{entry.session_type}</Badge>
              </View>
            </View>

            <H3 style={{ marginTop: spacing.sm }}>{entry.course_title}</H3>
            <Small style={{ marginTop: 2 }}>
              {entry.course_code}
              {entry.lecturer ? ` · ${entry.lecturer}` : ''}
            </Small>
            <Small style={{ marginTop: 4 }}>
              {entry.room_code ? `${entry.building_code ?? ''} ${entry.room_code} · ${entry.floor_name ?? ''}` : 'Room to be confirmed'}
            </Small>

            {entry.room_code ? (
              <View style={styles.actions}>
                <Pressable onPress={() => router.push(`/navigate/${encodeURIComponent(entry.room_code ?? '')}` as any)} style={styles.action}>
                  <Ionicons name="navigate-outline" size={16} color={colors.brand700} />
                  <Small style={{ color: colors.brand700, fontWeight: '600' }}>Navigate</Small>
                </Pressable>
                {entry.room_id ? (
                  <Pressable onPress={() => router.push(`/room/${encodeURIComponent(entry.room_code ?? '')}` as any)} style={styles.action}>
                    <Ionicons name="information-circle-outline" size={16} color={colors.ink600} />
                    <Small style={{ color: colors.ink600, fontWeight: '600' }}>Room details</Small>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </Card>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { padding: spacing.lg },
  padded: { paddingHorizontal: spacing.lg },
  dayStrip: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, flexWrap: 'wrap' },
  dayChip: {
    minWidth: 58,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.ink200,
    backgroundColor: colors.white,
    alignItems: 'center',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badges: { flexDirection: 'row', gap: spacing.xs, alignItems: 'center' },
  actions: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.md },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
