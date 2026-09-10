import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Badge, Body, Button, Card, Eyebrow, ErrorNote, H2, H3, KeyValue, Loading, Screen, SectionTitle, Small, Stat, Title } from '@/components/ui';
import { meApi } from '@/lib/api';
import { useAuth, useLoader } from '@/lib/auth';
import { colors, countdown, formatClock, relativeTime, spacing } from '@/lib/theme';

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const dashboard = useLoader(() => meApi.dashboard(), []);
  const data = dashboard.data;

  const firstName = (user?.name ?? data?.user.name ?? 'there').split(' ')[0];

  return (
    <Screen onRefresh={dashboard.reload} refreshing={dashboard.loading}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Eyebrow>{new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}</Eyebrow>
          <Title style={{ marginTop: 2 }}>Hi {firstName}</Title>
          <Small style={{ marginTop: 4 }}>
            {user?.role_code ? `${user.role_code} account` : 'student account'}
            {user?.registration_no ? ` · ${user.registration_no}` : ''}
          </Small>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Notifications"
          onPress={() => router.push('/notifications')}
          style={styles.bell}
        >
          <Ionicons name="notifications-outline" size={20} color={colors.ink700} />
          {data && data.unread_notifications > 0 ? (
            <View style={styles.badgeCount}>
              <Small style={{ color: colors.white, fontWeight: '700' }}>{data.unread_notifications > 9 ? '9+' : data.unread_notifications}</Small>
            </View>
          ) : null}
        </Pressable>
      </View>

      {dashboard.error ? <ErrorNote message={dashboard.error} onRetry={dashboard.reload} /> : null}
      {dashboard.loading && !data ? <Loading label="Loading your campus day…" /> : null}

      {data ? (
        <>
          {data.next_class ? (
            <Card style={{ backgroundColor: colors.brand600, borderColor: colors.brand600 }}>
              <Small style={{ color: '#dfe4ff', fontWeight: '700', textTransform: 'uppercase' }}>
                {data.next_class.is_now
                  ? 'In progress'
                  : `Next class · ${data.next_class.minutes_until === null ? 'soon' : `in ${data.next_class.minutes_until} min`}`}
              </Small>
              <H2 style={{ color: colors.white, marginTop: 4 }}>{data.next_class.course_title}</H2>
              <Small style={{ color: '#dfe4ff', marginTop: 4 }}>
                {formatClock(data.next_class.starts_at_iso)}–{formatClock(data.next_class.ends_at_iso)}
                {data.next_class.room_code ? ` · ${data.next_class.building_code ?? ''} ${data.next_class.room_code}` : ''}
                {data.next_class.lecturer ? ` · ${data.next_class.lecturer}` : ''}
              </Small>
              <View style={styles.row}>
                {data.next_class.room_code ? (
                  <Button
                    label="Navigate"
                    variant="secondary"
                    style={{ flex: 1 }}
                    onPress={() => router.push(`/navigate/${encodeURIComponent(data.next_class?.room_code ?? '')}`)}
                  />
                ) : null}
                <Button label="Timetable" variant="ghost" style={{ flex: 1 }} onPress={() => router.push('/timetable')} />
              </View>
            </Card>
          ) : (
            <Card>
              <H3>No class scheduled today</H3>
              <Small style={{ marginTop: 4 }}>Enjoy the quiet — your timetable is always up to date here.</Small>
            </Card>
          )}

          <View style={styles.stats}>
            <Stat label="Classes today" value={data.today.entries.length} />
            <Stat label="Unread" value={data.unread_notifications} tone={data.unread_notifications > 0 ? 'signal' : 'neutral'} />
          </View>

          {data.queue_ticket ? (
            <Card>
              <SectionTitle title="Your room queue" action={<Badge tone="mint">{data.queue_ticket.ticket.status}</Badge>} />
              <View style={styles.ticketRow}>
                <H2 style={styles.ticketNumber}>{data.queue_ticket.ticket.ticket_number}</H2>
                <View>
                  <Small>{data.queue_ticket.people_ahead} ahead</Small>
                  <Small>≈ {countdown(data.queue_ticket.eta_seconds)}</Small>
                </View>
              </View>
              <View style={{ marginTop: spacing.md }}>
                <KeyValue label="Room" value={`${data.queue_ticket.queue.room_code ?? ''} ${data.queue_ticket.queue.room_name ?? ''}`} />
                <KeyValue label="Check-in closes" value={countdown(data.queue_ticket.seconds_until_deadline)} />
                <KeyValue label="Expected service" value={formatClock(data.queue_ticket.expected_service_at)} />
              </View>
              <Button label="Open queue" variant="secondary" style={{ marginTop: spacing.md }} onPress={() => router.push('/queue')} />
            </Card>
          ) : null}

          {data.office_ticket ? (
            <Card>
              <SectionTitle title="Administrative office" action={<Badge tone="signal">{data.office_ticket.status_label}</Badge>} />
              <H2 style={styles.ticketNumber}>{data.office_ticket.ticket.ticket_number}</H2>
              <Small style={{ marginTop: 4 }}>
                {data.office_ticket.office.name} · {data.office_ticket.people_ahead} people ahead
              </Small>
              {data.office_ticket.expected_window ? (
                <Small style={{ marginTop: 4 }}>
                  Expected {formatClock(data.office_ticket.expected_window.starts_at)}–{formatClock(data.office_ticket.expected_window.ends_at)}
                </Small>
              ) : null}
              <Button label="Open tickets" variant="secondary" style={{ marginTop: spacing.md }} onPress={() => router.push('/offices')} />
            </Card>
          ) : null}

          {data.building_alerts.length > 0 ? (
            <Card style={{ backgroundColor: colors.signal100, borderColor: colors.signal100 }}>
              <H3 style={{ color: colors.signal700 }}>Building notices</H3>
              <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
                {data.building_alerts.map((alert) => (
                  <Small key={alert.id} style={{ color: colors.signal700 }}>
                    {alert.code} · {alert.name} — {alert.status}
                  </Small>
                ))}
              </View>
            </Card>
          ) : null}

          {data.today.entries.length > 0 ? (
            <Card>
              <SectionTitle title="Today" />
              {data.today.entries.map((entry) => (
                <View key={entry.id} style={styles.line}>
                  <Small style={styles.lineTime}>{formatClock(entry.starts_at_iso)}</Small>
                  <View style={{ flex: 1 }}>
                    <Small style={{ color: colors.ink800, fontWeight: '600' }}>{entry.course_code}</Small>
                    <Small>{entry.room_code ? `${entry.building_code ?? ''} ${entry.room_code}` : 'Room to be confirmed'}</Small>
                  </View>
                  {entry.is_now ? <Badge tone="mint">now</Badge> : entry.is_next ? <Badge tone="brand">next</Badge> : null}
                </View>
              ))}
              <Link href="/timetable">
                <Body style={{ color: colors.brand600, fontWeight: '600', marginTop: spacing.md }}>Open the full week →</Body>
              </Link>
            </Card>
          ) : null}

          {data.announcements.length > 0 ? (
            <Card>
              <SectionTitle title="Campus notices" />
              {data.announcements.slice(0, 3).map((announcement) => (
                <View key={announcement.id} style={{ marginBottom: spacing.md }}>
                  <View style={styles.lineTitle}>
                    <Small style={{ color: colors.ink800, fontWeight: '600', flex: 1 }}>{announcement.title}</Small>
                    {announcement.is_pinned ? <Badge tone="signal">pinned</Badge> : null}
                  </View>
                  <Small style={{ marginTop: 2 }}>{announcement.body.slice(0, 140)}</Small>
                </View>
              ))}
            </Card>
          ) : null}

          {data.events.length > 0 ? (
            <Card>
              <SectionTitle title="What's happening" />
              {data.events.slice(0, 3).map((event) => (
                <View key={event.id} style={styles.line}>
                  <View style={{ flex: 1 }}>
                    <Small style={{ color: colors.ink800, fontWeight: '600' }}>{event.title}</Small>
                    <Small>
                      {relativeTime(event.starts_at)}
                      {event.venue ? ` · ${event.venue}` : ''}
                    </Small>
                  </View>
                  <Badge tone="brand">{event.category}</Badge>
                </View>
              ))}
            </Card>
          ) : null}

          <Small style={{ textAlign: 'center', marginTop: spacing.sm }}>
            {data.position ? `Position from ${data.position.source} · updated ${relativeTime(data.position.updated_at)}` : 'Scan a QR anchor to fix your indoor position'}
          </Small>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', padding: spacing.lg, gap: spacing.md },
  headerText: { flex: 1 },
  bell: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.ink100,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeCount: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    paddingHorizontal: 4,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.coral500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  stats: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  ticketRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  ticketNumber: { letterSpacing: 0.5 },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  lineTime: { width: 46 },
  lineTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
