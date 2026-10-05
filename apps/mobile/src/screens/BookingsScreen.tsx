import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { ApiError, api } from '../api';
import { colours, statusColours, styles } from '../theme';
import type { Booking, CampusModel } from '../types';

function tomorrowAt(hour: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(hour, 0, 0, 0);
  return date;
}

/** Request an administrative room, and follow the scolarité's decision. */
export function BookingsScreen() {
  const [campus, setCampus] = useState<CampusModel | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [roomId, setRoomId] = useState('');
  const [purpose, setPurpose] = useState('');
  const [hour, setHour] = useState(10);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [model, payload] = await Promise.all([
        api<CampusModel>('/universities/iai-cameroun/campus'),
        api<{ items: Booking[] }>('/bookings'),
      ]);
      setCampus(model);
      setBookings(payload.items);
      setRoomId((current) => current || model.rooms.find((room) => room.bookable)?.id || '');
    } catch {
      setError('Les salles n’ont pas pu être chargées.');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit() {
    setError(null);
    setOk(null);
    const startsAt = tomorrowAt(hour);
    const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
    try {
      await api('/bookings', {
        method: 'POST',
        body: { roomId, purpose: purpose.trim(), startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() },
      });
      setOk('Demande envoyée. Vous serez notifié de la décision.');
      setPurpose('');
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'La demande n’a pas pu être envoyée.');
    }
  }

  const bookable = (campus?.rooms ?? []).filter((room) => room.bookable);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load()} />}
    >
      <Text style={styles.eyebrow}>Services</Text>
      <Text style={styles.title}>Réserver une salle</Text>
      <Text style={styles.subtitle}>
        Les salles administratives se demandent, elles ne se confirment pas toutes seules : la scolarité approuve ou refuse.
      </Text>

      {error ? <Text style={[styles.notice, styles.noticeError]}>{error}</Text> : null}
      {ok ? <Text style={[styles.notice, styles.noticeOk]}>{ok}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Nouvelle demande</Text>
        {bookable.map((room) => (
          <Pressable
            key={room.id}
            accessibilityRole="button"
            style={[styles.button, styles.buttonGhost, roomId === room.id && { borderColor: colours.brand }]}
            onPress={() => setRoomId(room.id)}
          >
            <Text style={styles.buttonGhostText}>
              {room.code} — {room.name}
            </Text>
          </Pressable>
        ))}
        <View>
          <Text style={styles.label}>Motif</Text>
          <TextInput
            style={[styles.input, { minHeight: 80, textAlignVertical: 'top', paddingTop: 10 }]}
            multiline
            value={purpose}
            onChangeText={setPurpose}
            placeholder="Entretien de suivi de stage"
            placeholderTextColor={colours.ink500}
          />
        </View>
        <View style={styles.row}>
          {[8, 10, 14, 16].map((value) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              style={[styles.button, styles.buttonGhost, { flex: 1 }, hour === value && { borderColor: colours.brand }]}
              onPress={() => setHour(value)}
            >
              <Text style={styles.buttonGhostText}>{value}h</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.muted}>Demain, {hour}h00 → {hour + 1}h00.</Text>
        <Pressable accessibilityRole="button" style={styles.button} onPress={() => void submit()}>
          <Text style={styles.buttonText}>Envoyer la demande</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Mes demandes</Text>
        {bookings.length === 0 ? <Text style={styles.muted}>Aucune demande.</Text> : null}
        {bookings.map((booking) => (
          <View key={booking.id} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700' }}>{booking.room?.name}</Text>
              <Text style={styles.muted}>
                {new Date(booking.startsAt).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })} · {booking.purpose}
              </Text>
              {booking.decisionNote ? <Text style={styles.muted}>Note : {booking.decisionNote}</Text> : null}
            </View>
            <Text style={[styles.tag, statusColours(booking.status)]}>{booking.status}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
