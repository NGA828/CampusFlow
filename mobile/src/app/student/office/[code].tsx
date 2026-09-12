import * as Location from 'expo-location';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';

import { Badge, Button, Card, ErrorNote, Eyebrow, H2, H3, KeyValue, Loading, Screen, SectionTitle, Small, Stat, Title } from '@/components/ui';
import { ApiError, officeApi } from '@/lib/api';
import { useLoader } from '@/lib/auth';
import { colors, countdown, dayName, formatClock, radius, spacing } from '@/lib/theme';

export default function OfficeDetailScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const office = useLoader(() => officeApi.detail(String(code)), [code]);
  const [subject, setSubject] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const detail = office.data;
  const ticket = detail?.my_ticket ?? null;

  const fix = async (): Promise<Record<string, unknown> | undefined> => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') return undefined;
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      return { lat: location.coords.latitude, lng: location.coords.longitude, accuracy_m: location.coords.accuracy, source: 'gps' };
    } catch {
      return undefined;
    }
  };

  const request = async () => {
    if (!detail) return;
    setBusy(true);
    setNotice(null);
    try {
      const locationFix = await fix();
      await officeApi.request(detail.office.id, {
        subject: subject.trim() || 'Student enquiry',
        notes: notes.trim() || undefined,
        ...(locationFix ? { fix: locationFix } : {}),
      });
      setNotice('Ticket issued. Your number is shown below.');
      office.reload();
    } catch (caught) {
      Alert.alert('Office ticket', caught instanceof ApiError ? (caught.firstError ?? caught.message) : 'Could not create the ticket.');
    } finally {
      setBusy(false);
    }
  };

  const checkIn = async () => {
    if (!ticket) return;
    setBusy(true);
    try {
      const locationFix = await fix();
      await officeApi.checkIn(ticket.ticket.id, locationFix ? { fix: locationFix } : {});
      office.reload();
    } catch (caught) {
      Alert.alert('Check-in', caught instanceof ApiError ? (caught.firstError ?? caught.message) : 'Check-in failed.');
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!ticket) return;
    setBusy(true);
    try {
      await officeApi.cancel(ticket.ticket.id);
      office.reload();
    } catch (caught) {
      Alert.alert('Cancel', caught instanceof ApiError ? (caught.firstError ?? caught.message) : 'Cancel failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen onRefresh={office.reload} refreshing={office.loading}>
      <View style={styles.header}>
        <Eyebrow>Service desk</Eyebrow>
        <Title style={{ marginTop: 2 }}>{detail?.office.name ?? String(code)}</Title>
        {detail ? (
          <Small style={{ marginTop: 4 }}>
            {detail.office.building_code ?? ''} · {detail.office.room_code ?? detail.office.floor_name ?? ''}
          </Small>
        ) : null}
      </View>

      {office.error ? (
        <View style={styles.padded}>
          <ErrorNote message={office.error} onRetry={office.reload} />
        </View>
      ) : null}

      {office.loading && !detail ? <Loading label="Loading office…" /> : null}

      {detail ? (
        <View style={styles.padded}>
          <Card>
            <SectionTitle title="Live status" action={<Badge tone={detail.is_open_now ? 'mint' : 'neutral'}>{detail.is_open_now ? 'open' : 'closed'}</Badge>} />
            <View style={styles.stats}>
              <Stat label="Waiting" value={detail.counts.waiting} />
              <Stat label="In service" value={detail.counts.in_service} />
              <Stat label="Avg service" value={`${detail.average_service_minutes}m`} />
            </View>
            <View style={{ marginTop: spacing.md }}>
              <KeyValue label="Next ticket" value={detail.next_ticket_number} />
              <KeyValue label="Estimated wait" value={`${detail.estimated_wait_minutes} min`} />
              <KeyValue
                label="Today"
                value={detail.today_windows.length > 0 ? `${detail.today_windows[0].opens_at.slice(0, 5)}–${detail.today_windows[0].closes_at.slice(0, 5)}` : 'closed today'}
              />
              {detail.expected_window ? (
                <KeyValue label="Your window" value={`${formatClock(detail.expected_window.starts_at)}–${formatClock(detail.expected_window.ends_at)}`} />
              ) : null}
              {detail.daily_capacity ? <KeyValue label="Capacity used" value={`${detail.daily_capacity_used}/${detail.daily_capacity}`} /> : null}
            </View>
          </Card>

          {ticket ? (
            <Card style={{ marginTop: spacing.lg, borderColor: colors.brand300 }}>
              <SectionTitle title="Your ticket" action={<Badge tone="brand">{ticket.status_label}</Badge>} />
              <H2 style={{ letterSpacing: 1 }}>{ticket.ticket.ticket_number}</H2>
              <Small style={{ marginTop: 4 }}>{ticket.ticket.subject}</Small>
              <View style={styles.stats}>
                <Stat label="People ahead" value={ticket.people_ahead} tone="brand" />
                <Stat label="Wait" value={countdown(ticket.eta_seconds)} tone="mint" />
              </View>
              <Button
                label={ticket.can_check_in ? 'Check in now' : 'Check in after you are called'}
                disabled={!ticket.can_check_in}
                loading={busy}
                onPress={() => void checkIn()}
                style={{ marginTop: spacing.lg }}
              />
              {ticket.can_cancel ? <Button label="Cancel ticket" variant="ghost" loading={busy} onPress={() => void cancel()} style={{ marginTop: spacing.sm }} /> : null}
            </Card>
          ) : (
            <Card style={{ marginTop: spacing.lg }}>
              <H3>Request a ticket</H3>
              <Small style={{ marginTop: 4 }}>
                {detail.office.requires_proximity_to_request
                  ? `You must be within ${detail.office.check_in_radius_m} m of the office, or scan its QR anchor.`
                  : 'You can request remotely and come when you are called.'}
              </Small>
              <TextInput
                value={subject}
                onChangeText={setSubject}
                placeholder="What do you need help with?"
                placeholderTextColor={colors.ink400}
                style={styles.input}
                accessibilityLabel="Subject"
              />
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Optional details (documents, reference numbers)"
                placeholderTextColor={colors.ink400}
                style={[styles.input, { minHeight: 80 }]}
                multiline
                accessibilityLabel="Notes"
              />
              {notice ? <Small style={{ marginTop: spacing.sm, color: colors.mint700, fontWeight: '600' }}>{notice}</Small> : null}
              <Button label="Take a ticket" loading={busy} onPress={() => void request()} style={{ marginTop: spacing.md }} />
            </Card>
          )}

          <Card style={{ marginTop: spacing.lg }}>
            <SectionTitle title="Opening hours" />
            {detail.windows.length === 0 ? (
              <Small>No service windows published.</Small>
            ) : (
              detail.windows.map((window) => (
                <KeyValue
                  key={window.id}
                  label={dayName(window.day_of_week)}
                  value={`${window.opens_at.slice(0, 5)}–${window.closes_at.slice(0, 5)}${window.is_active ? '' : ' (inactive)'}`}
                />
              ))
            )}
          </Card>

          {detail.staff.length > 0 ? (
            <Card style={{ marginTop: spacing.lg }}>
              <SectionTitle title="Staff on duty" />
              {detail.staff.map((member) => (
                <KeyValue key={member.id} label={member.role} value={member.name} />
              ))}
            </Card>
          ) : null}

          {detail.office.contact_email ? (
            <Card style={{ marginTop: spacing.lg }}>
              <SectionTitle title="Contact" />
              <KeyValue label="Email" value={detail.office.contact_email} />
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
  stats: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  input: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.ink200,
    borderRadius: radius.control,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.ink800,
    backgroundColor: colors.white,
  },
});
