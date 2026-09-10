import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Badge, Button, Card, ErrorNote, Eyebrow, H3, ListRow, Loading, Screen, Small, Stat, Title } from '@/components/ui';
import { officeApi } from '@/lib/api';
import { useLoader } from '@/lib/auth';
import { colors, formatClock, spacing } from '@/lib/theme';

export default function OfficesScreen() {
  const router = useRouter();
  const offices = useLoader(() => officeApi.list(), []);
  const myTicket = offices.data?.my_ticket ?? null;

  return (
    <Screen onRefresh={offices.reload} refreshing={offices.loading}>
      <View style={styles.header}>
        <Eyebrow>Administrative offices</Eyebrow>
        <Title style={{ marginTop: 2 }}>Service desks</Title>
        <Small style={{ marginTop: 4 }}>
          Take a ticket for the office you need — you will see your number, position and the expected service window.
        </Small>
      </View>

      {offices.error ? (
        <View style={styles.padded}>
          <ErrorNote message={offices.error} onRetry={offices.reload} />
        </View>
      ) : null}

      {offices.loading && !offices.data ? <Loading label="Loading offices…" /> : null}

      {myTicket ? (
        <View style={styles.padded}>
          <Card style={{ borderColor: colors.signal400, marginBottom: spacing.lg }}>
            <Badge tone="signal">{myTicket.status_label}</Badge>
            <H3 style={{ marginTop: spacing.sm }}>{myTicket.ticket.ticket_number}</H3>
            <Small style={{ marginTop: 2 }}>
              {myTicket.office.name} · {myTicket.people_ahead} ahead
            </Small>
            {myTicket.expected_window ? (
              <Small style={{ marginTop: 2 }}>
                Expected {formatClock(myTicket.expected_window.starts_at)}–{formatClock(myTicket.expected_window.ends_at)}
              </Small>
            ) : null}
            <Button label="Open my ticket" variant="secondary" onPress={() => router.push(`/office/${myTicket.office.code}`)} style={{ marginTop: spacing.md }} />
          </Card>
        </View>
      ) : null}

      <View style={styles.padded}>
        {offices.data?.offices.map((summary) => (
          <Card key={summary.office.id} style={{ marginBottom: spacing.md }}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <H3>{summary.office.name}</H3>
                <Small style={{ marginTop: 2 }}>
                  {summary.office.building_code ?? ''} · {summary.office.room_code ?? summary.office.floor_name ?? 'location pending'}
                </Small>
              </View>
              <Badge tone={summary.is_open_now ? 'mint' : 'neutral'}>{summary.is_open_now ? 'open now' : 'closed'}</Badge>
            </View>

            <View style={styles.stats}>
              <Stat label="Waiting" value={summary.counts.waiting} />
              <Stat label="In service" value={summary.counts.in_service} />
              <Stat label="Wait" value={`${summary.estimated_wait_minutes}m`} tone="mint" />
            </View>

            <View style={{ marginTop: spacing.md }}>
              <Small>
                {summary.is_open_now && summary.opens_at && summary.closes_at
                  ? `Today ${summary.opens_at.slice(0, 5)}–${summary.closes_at.slice(0, 5)}`
                  : summary.next_opening
                    ? `Next opening ${formatClock(summary.next_opening)}`
                    : 'No service window published'}
                {summary.daily_capacity ? ` · capacity ${summary.daily_capacity_used}/${summary.daily_capacity}` : ''}
              </Small>
              <Small style={{ marginTop: 2 }}>
                Next ticket {summary.next_ticket_number} · avg {summary.average_service_minutes} min
                {summary.office.requires_proximity_to_request ? ` · check in within ${summary.office.check_in_radius_m} m` : ''}
              </Small>
            </View>

            <Button label="Request a ticket" onPress={() => router.push(`/office/${summary.office.code}`)} style={{ marginTop: spacing.md }} />
          </Card>
        ))}

        {offices.data?.offices.length === 0 ? (
          <Card>
            <H3>No offices configured</H3>
            <Small style={{ marginTop: 4 }}>An administrator can add service desks from the admin console.</Small>
          </Card>
        ) : null}

        <ListRow>
          <Small>Ticket numbers are issued inside a database transaction — no duplicates, no queue jumping.</Small>
        </ListRow>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { padding: spacing.lg },
  padded: { paddingHorizontal: spacing.lg },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  stats: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
});
