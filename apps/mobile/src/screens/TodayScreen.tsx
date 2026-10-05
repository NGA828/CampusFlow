import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { api } from '../api';
import { useSession } from '../session';
import { statusColours, styles } from '../theme';
import type { Announcement, Booking, CampusEvent, NotificationItem } from '../types';

function when(value: string): string {
  return new Date(value).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
}

/** The student's day: appointments, unread notifications, events and notices. */
export function TodayScreen() {
  const { user, signOut } = useSession();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [events, setEvents] = useState<CampusEvent[]>([]);
  const [notices, setNotices] = useState<Announcement[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      const [bookingPayload, notificationPayload, eventPayload, noticePayload] = await Promise.all([
        api<{ items: Booking[] }>('/bookings'),
        api<{ items: NotificationItem[] }>('/notifications'),
        api<{ items: CampusEvent[] }>(`/events?university=${user.universitySlug}`),
        api<{ items: Announcement[] }>(`/announcements?university=${user.universitySlug}`),
      ]);
      setBookings(bookingPayload.items);
      setNotifications(notificationPayload.items);
      setEvents(eventPayload.items);
      setNotices(noticePayload.items);
      setError(null);
    } catch {
      setError('Your campus data could not be loaded. Pull down to retry.');
    } finally {
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const upcoming = bookings.filter((booking) => booking.status !== 'CANCELLED' && Date.parse(booking.endsAt) > Date.now());
  const unread = notifications.filter((item) => !item.readAt);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load()} />}
    >
      <Text style={styles.eyebrow}>Student · IAI Cameroun</Text>
      <Text style={styles.title}>Bonjour, {user?.name.split(' ')[0]}.</Text>
      <Text style={styles.subtitle}>
        {user?.matricule ? `Matricule ${user.matricule} · ` : ''}
        {unread.length > 0 ? `${unread.length} notification${unread.length > 1 ? 's' : ''} non lue${unread.length > 1 ? 's' : ''}` : 'Rien de nouveau'}
      </Text>

      {error ? <Text style={[styles.notice, styles.noticeError]}>{error}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Prochains rendez-vous</Text>
        {upcoming.length === 0 ? <Text style={styles.muted}>Aucun rendez-vous à venir.</Text> : null}
        {upcoming.map((booking) => (
          <View key={booking.id} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700' }}>{booking.room?.name}</Text>
              <Text style={styles.muted}>
                {booking.room?.buildingName} · {booking.room?.floorName}
              </Text>
              <Text style={styles.muted}>{when(booking.startsAt)}</Text>
            </View>
            <Text style={[styles.tag, statusColours(booking.status)]}>{booking.status}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Notifications</Text>
        {notifications.length === 0 ? <Text style={styles.muted}>Aucune notification.</Text> : null}
        {notifications.slice(0, 6).map((item) => (
          <Pressable
            key={item.id}
            onPress={async () => {
              if (item.readAt) return;
              await api(`/notifications/${item.id}/read`, { method: 'POST' });
              setNotifications((current) => current.map((entry) => (entry.id === item.id ? { ...entry, readAt: new Date().toISOString() } : entry)));
            }}
            style={styles.row}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700' }}>{item.title}</Text>
              <Text style={styles.muted}>{item.body}</Text>
            </View>
            {item.readAt ? null : <Text style={[styles.tag, { backgroundColor: '#e5eaff', color: '#2a4bd8' }]}>NEW</Text>}
          </Pressable>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Événements</Text>
        {events.slice(0, 4).map((event) => (
          <View key={event.id}>
            <Text style={{ fontWeight: '700' }}>{event.title}</Text>
            <Text style={styles.muted}>
              {event.venue} · {when(event.startsAt)}
            </Text>
          </View>
        ))}
        {events.length === 0 ? <Text style={styles.muted}>Aucun événement publié.</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Annonces</Text>
        {notices.slice(0, 4).map((notice) => (
          <View key={notice.id}>
            <Text style={{ fontWeight: '700' }}>{notice.title}</Text>
            <Text style={styles.muted}>{notice.body}</Text>
          </View>
        ))}
        {notices.length === 0 ? <Text style={styles.muted}>Aucune annonce publiée.</Text> : null}
      </View>

      <Pressable accessibilityRole="button" style={[styles.button, styles.buttonGhost]} onPress={() => void signOut()}>
        <Text style={styles.buttonGhostText}>Se déconnecter</Text>
      </Pressable>
    </ScrollView>
  );
}
