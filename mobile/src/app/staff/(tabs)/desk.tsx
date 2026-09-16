import { useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';

import { AdaptiveRow, Badge, Button, Card, EmptyState, ErrorNote, Eyebrow, H3, KeyValue, Loading, Screen, Small, Title } from '@/components/ui';
import { IconTile, Notice, PageIntro } from '@/components/visual';
import { ApiError, staffApi } from '@/lib/api';
import { useLoader } from '@/lib/auth';
import { colors, formatClock, radius, spacing } from '@/lib/theme';
import type { StaffStudentLookup } from '@/lib/types';

/**
 * The desk: two things a phone is good at — verifying who is standing in front of you, and clearing the
 * tickets that are waiting on a decision.
 *
 * Verification is a lookup by registration number and it returns identity plus what is outstanding for
 * that student at *this* role's desks. It does not return a timetable, a history of rooms visited, or a map
 * of where the person is: those would turn a service desk into a tracking tool. A lookup failure is
 * reported as a refusal, never as an empty student.
 */
export default function StaffDeskScreen() {
  const [registration, setRegistration] = useState('');
  const [lookup, setLookup] = useState<StaffStudentLookup | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dashboard = useLoader(() => staffApi.dashboard(), []);
  const queueActions = dashboard.data?.pending_queue_actions ?? [];
  const officeActions = dashboard.data?.pending_office_actions ?? [];

  const search = async () => {
    const term = registration.trim();
    if (!term) return;
    setBusy(true);
    setError(null);
    try {
      setLookup(await staffApi.studentLookup(term));
    } catch (caught) {
      setLookup(null);
      setError(caught instanceof ApiError ? (caught.firstError ?? caught.message) : 'That number could not be checked.');
    } finally {
      setBusy(false);
    }
  };

  const act = async (label: string, run: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await run();
      dashboard.reload();
    } catch (caught) {
      Alert.alert('Desk', caught instanceof ApiError ? (caught.firstError ?? caught.message) : 'That action could not be completed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen bottomSafeArea={false} onRefresh={dashboard.reload} refreshing={dashboard.loading}>
      <PageIntro eyebrow="Staff · service desk" title="A smoother handover." description="Verify the person in front of you. Take the next step on their ticket." icon="id-card-outline" />
      <View style={styles.padded}>
        <Card>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 12 }}><IconTile name="id-card-outline" tone="mint" /><View style={{ flex: 1 }}><Eyebrow>Identity check</Eyebrow><H3 style={{ marginTop: 4 }}>Verify a student</H3></View></View>
          <Small>Check the registration number a student gives you before anything is signed or released.</Small>
          <TextInput
            accessibilityLabel="Student registration number"
            value={registration}
            onChangeText={setRegistration}
            onSubmitEditing={() => void search()}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="e.g. 2021/142/00123"
            placeholderTextColor={colors.ink400}
            style={styles.input}
          />
          <Button label="Look up" disabled={busy || !registration.trim()} loading={busy && !lookup && !error} onPress={() => void search()} style={{ marginTop: spacing.sm }} />

          {error ? <ErrorNote message={error} /> : null}

          {lookup ? (
            <View style={{ marginTop: spacing.md }}>
              <Notice icon="person-circle-outline" title={lookup.student.name} tone={lookup.student.status === 'active' ? 'mint' : 'signal'}>Campus record found · {lookup.student.status ?? 'status unknown'}</Notice>
              <KeyValue label="Name" value={lookup.student.name} />
              <KeyValue label="Number" value={lookup.student.registration_no ?? '—'} />
              <KeyValue label="Programme" value={lookup.student.program ?? '—'} />
              <KeyValue label="Year" value={lookup.student.year_level ?? '—'} />
              <KeyValue
                label="Status"
                value={lookup.student.status ?? 'unknown'}
                tone={lookup.student.status === 'active' ? 'mint' : 'coral'}
              />
              {lookup.queue_tickets.length > 0 ? (
                <>
                  <Small style={{ marginTop: spacing.sm }}>In a line: {lookup.queue_tickets.map((t) => `${t.ticket_number} (${t.status})`).join(', ')}</Small>
                </>
              ) : null}
              {lookup.office_tickets.length > 0 ? (
                <Small style={{ marginTop: spacing.xs }}>
                  At a desk: {lookup.office_tickets.map((t) => `${t.ticket_number} ${t.office ?? ''} (${t.status})`).join(', ')}
                </Small>
              ) : null}
              {lookup.queue_tickets.length === 0 && lookup.office_tickets.length === 0 ? (
                <Small style={{ marginTop: spacing.sm }}>No ticket is outstanding for this student.</Small>
              ) : null}
            </View>
          ) : null}
        </Card>

        <H3 style={{ marginTop: spacing.lg }}>Called and waiting</H3>
        {dashboard.loading && !dashboard.data ? <Loading label="Loading the desk…" /> : null}
        {dashboard.error ? <ErrorNote message={dashboard.error} onRetry={dashboard.reload} /> : null}

        {dashboard.data && !dashboard.error && queueActions.length === 0 && officeActions.length === 0 ? (
          <EmptyState title="Nothing is waiting on you" description="Called and checked-in tickets appear here so you can admit, complete or mark a no-show without opening a laptop." />
        ) : null}

        {queueActions.map((action) => (
          <Card key={action.id} style={{ marginTop: spacing.md }}>
            <View style={styles.row}>
              <IconTile name="ticket-outline" size={40} />
              <View style={{ flex: 1 }}>
                <Title style={{ fontSize: 16 }}>{action.ticket_number}</Title>
                <Small>
                  {action.student_name} · {action.room_code ?? 'room unknown'}
                </Small>
              </View>
              <Badge tone={action.status === 'checked_in' ? 'mint' : 'signal'}>{action.status.replace('_', ' ')}</Badge>
            </View>
            <Small style={{ marginTop: spacing.xs }}>
              {action.check_in_deadline ? `Check-in due ${formatClock(action.check_in_deadline)}` : 'No check-in deadline on this ticket'}
            </Small>
            <AdaptiveRow style={styles.actions}>
              {action.status === 'called' ? (
                <Button label="Check in" disabled={busy} variant="secondary" onPress={() => void act(action.id, () => staffApi.checkInTicket(action.id))} style={{ flex: 1 }} />
              ) : null}
              <Button label="Admit" disabled={busy} onPress={() => void act(`admit-${action.id}`, () => staffApi.admitTicket(action.id))} style={{ flex: 1 }} />
              <Button label="No-show" disabled={busy} variant="ghost" onPress={() => void act(`ns-${action.id}`, () => staffApi.noShowTicket(action.id))} style={{ flex: 1 }} />
            </AdaptiveRow>
          </Card>
        ))}

        {officeActions.map((action) => (
          <Card key={action.id} style={{ marginTop: spacing.md }}>
            <View style={styles.row}>
              <IconTile name="ticket-outline" size={40} />
              <View style={{ flex: 1 }}>
                <Title style={{ fontSize: 16 }}>{action.ticket_number}</Title>
                <Small>{action.subject ?? 'Service request'}</Small>
              </View>
              <Badge tone={action.status === 'in_service' ? 'brand' : 'signal'}>{action.status.replace('_', ' ')}</Badge>
            </View>
            <AdaptiveRow style={styles.actions}>
              {action.status !== 'in_service' ? (
                <Button label="Start" disabled={busy} variant="secondary" onPress={() => void act(`st-${action.id}`, () => staffApi.officeStartService(action.id))} style={{ flex: 1 }} />
              ) : null}
              <Button label="Complete" disabled={busy} onPress={() => void act(`cp-${action.id}`, () => staffApi.officeComplete(action.id))} style={{ flex: 1 }} />
            </AdaptiveRow>
          </Card>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  padded: { paddingHorizontal: 20, marginTop: 4, paddingBottom: spacing.xl },
  input: {
    minHeight: 54,
    fontSize: 16,
    backgroundColor: colors.ink50,
    borderColor: colors.ink200,
    borderRadius: radius.control,
    borderWidth: 1,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: colors.ink800,
  },
  row: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  actions: { marginTop: spacing.md },
});
