import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Badge, Button, Card, EmptyState, ErrorNote, Eyebrow, H3, Loading, Screen, Small, Stat, Title } from '@/components/ui';
import { ApiError, staffApi } from '@/lib/api';
import { useLoader } from '@/lib/auth';
import { dayName, formatClock, spacing } from '@/lib/theme';

/**
 * An administrative office, worked from behind the counter.
 *
 * A desk has one thing a room queue does not: a schedule. The windows below are read from the office's own
 * service windows so the operator can see whether the person in front of them is standing at an open
 * window at all — the request itself was already gated on the same data, and an administrator changes it on
 * the web console (`/admin/services`), never here.
 */
export default function StaffOfficeDeskScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const desk = useLoader(() => staffApi.officeLine(String(id)), [id]);
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (label: string, action: () => Promise<unknown>) => {
    setBusy(label);
    try {
      await action();
      desk.reload();
    } catch (caught) {
      Alert.alert('Desk', caught instanceof ApiError ? (caught.firstError ?? caught.message) : 'That action could not be completed.');
    } finally {
      setBusy(null);
    }
  };

  if (desk.loading && !desk.data) return <Loading label="Opening the desk…" />;

  const office = desk.data?.office;
  const rows = desk.data?.line ?? [];
  const windows = desk.data?.windows ?? [];
  const counts = desk.data?.counts ?? { waiting: 0, called: 0, in_service: 0 };
  const today = new Date().getDay();

  return (
    <Screen onRefresh={desk.reload} refreshing={desk.loading}>
      <View style={styles.header}>
        <Eyebrow>{office?.code ?? 'Office'}</Eyebrow>
        <Title style={{ marginTop: 2 }}>{office?.name ?? 'Service desk'}</Title>
      </View>

      {desk.error ? (
        <View style={styles.padded}>
          <ErrorNote message={desk.error} onRetry={desk.reload} />
        </View>
      ) : null}

      {office ? (
        <View style={styles.padded}>
          <Card>
            <Small>
              {office.room_code ? `${office.room_code} · ` : ''}
              about {office.service_duration_minutes} minutes per visit ·{' '}
              {office.daily_capacity !== null ? `${office.daily_capacity} tickets a day` : 'no daily ticket ceiling'}
            </Small>
            <View style={styles.stats}>
              <Stat label="Waiting" value={counts.waiting} />
              <Stat label="Called" value={counts.called} tone={counts.called > 0 ? 'signal' : 'neutral'} />
              <Stat label="In service" value={counts.in_service} tone="brand" />
            </View>
            <View style={styles.actions}>
              <Button
                label="Call next"
                disabled={counts.waiting === 0}
                loading={busy === 'next'}
                onPress={() => void run('next', () => staffApi.officeCallNext(office.id))}
                style={{ flex: 1 }}
              />
            </View>
          </Card>

          <H3 style={{ marginTop: spacing.lg }}>Windows today</H3>
          {windows.length === 0 ? (
            <Small style={{ marginTop: spacing.xs }}>No service windows are configured for this office.</Small>
          ) : (
            windows.map((window) => (
              <View key={window.id} style={styles.windowRow}>
                <Small style={{ flex: 1 }}>
                  {dayName(window.day_of_week ?? today)} · {String(window.opens_at).slice(0, 5)}–{String(window.closes_at).slice(0, 5)}
                </Small>
                <Badge tone={window.is_active ? 'mint' : 'neutral'}>{window.is_active ? 'active' : 'closed'}</Badge>
              </View>
            ))
          )}

          <H3 style={{ marginTop: spacing.lg }}>{rows.length} at the desk</H3>
          {rows.length === 0 ? <EmptyState title="No tickets open" description="Requests students send for this office land here." /> : null}

          {rows.map((ticket) => (
            <Card key={ticket.id} style={{ marginTop: spacing.md }}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Title style={{ fontSize: 16 }}>{ticket.ticket_number}</Title>
                  <Small>{ticket.user_name ?? 'Student'}</Small>
                  {ticket.subject ? <Small style={{ marginTop: 4 }}>{ticket.subject}</Small> : null}
                </View>
                <Badge tone={ticket.status === 'in_service' ? 'brand' : ticket.status === 'called' ? 'signal' : 'neutral'}>
                  {ticket.status.replace('_', ' ')}
                </Badge>
              </View>
              <View style={styles.actions}>
                {ticket.status === 'waiting' ? (
                  <Button label="Call" onPress={() => void run(`call-${ticket.id}`, () => staffApi.officeCallTicket(ticket.id))} style={{ flex: 1 }} />
                ) : null}
                {ticket.status === 'called' ? (
                  <Button label="Check in" variant="secondary" onPress={() => void run(`ci-${ticket.id}`, () => staffApi.officeCheckIn(ticket.id))} style={{ flex: 1 }} />
                ) : null}
                {ticket.status !== 'in_service' ? (
                  <Button
                    label="Start service"
                    variant="secondary"
                    loading={busy === `st-${ticket.id}`}
                    onPress={() => void run(`st-${ticket.id}`, () => staffApi.officeStartService(ticket.id))}
                    style={{ flex: 1 }}
                  />
                ) : null}
                <Button
                  label="Complete"
                  loading={busy === `done-${ticket.id}`}
                  onPress={() => void run(`done-${ticket.id}`, () => staffApi.officeComplete(ticket.id))}
                  style={{ flex: 1 }}
                />
                {ticket.status === 'called' ? (
                  <Button label="No-show" variant="ghost" onPress={() => void run(`ns-${ticket.id}`, () => staffApi.officeNoShow(ticket.id))} style={{ flex: 1 }} />
                ) : null}
              </View>
            </Card>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  padded: { paddingHorizontal: spacing.lg, marginTop: spacing.md, paddingBottom: spacing.xl },
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  windowRow: { alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, flexDirection: 'row', marginTop: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: 10 },
});
