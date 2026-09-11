import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Badge, Card, ErrorNote, Eyebrow, H3, Loading, Screen, Small, Title } from '@/components/ui';
import { campusApi, positioningApi } from '@/lib/api';
import { useLoader } from '@/lib/auth';
import { colors, radius, relativeTime, spacing } from '@/lib/theme';

export default function MapScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const buildings = useLoader(() => campusApi.buildings(), []);
  const rooms = useLoader(() => campusApi.rooms({ q: query || undefined, per_page: 30 }), [query]);
  const position = useLoader(() => positioningApi.current(), []);

  const searching = query.trim().length > 1;

  return (
    <Screen onRefresh={buildings.reload} refreshing={buildings.loading}>
      <View style={styles.header}>
        <Eyebrow>Campus</Eyebrow>
        <Title style={{ marginTop: 2 }}>Find a room</Title>
        <Small style={{ marginTop: 4 }}>
          {position.data?.position
            ? `Position fixed from ${position.data.position.source} · ${relativeTime(position.data.position.updated_at)}`
            : 'Scan a QR anchor inside a building for indoor accuracy'}
        </Small>
      </View>

      <View style={styles.padded}>
        <View style={styles.search}>
          <Ionicons name="search-outline" size={18} color={colors.ink400} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search room code or name"
            placeholderTextColor={colors.ink400}
            style={styles.searchInput}
            accessibilityLabel="Search rooms"
            autoCapitalize="characters"
          />
        </View>

        <View style={styles.actions}>
          <Pressable style={styles.action} onPress={() => router.push('/scan' as any)}>
            <Ionicons name="qr-code-outline" size={18} color={colors.brand700} />
            <Small style={{ color: colors.brand700, fontWeight: '700' }}>Scan anchor</Small>
          </Pressable>
          <Pressable style={styles.action} onPress={() => router.push('/room/A-103' as any)}>
            <Ionicons name="navigate-outline" size={18} color={colors.ink600} />
            <Small style={{ color: colors.ink600, fontWeight: '700' }}>Try a route</Small>
          </Pressable>
        </View>
      </View>

      {buildings.error ? (
        <View style={styles.padded}>
          <ErrorNote message={buildings.error} onRetry={buildings.reload} />
        </View>
      ) : null}

      {buildings.loading && !buildings.data ? <Loading label="Loading buildings…" /> : null}

      {!searching && buildings.data ? (
        <View style={styles.padded}>
          {buildings.data.buildings.map((building) => (
            <Card key={building.id} style={{ marginBottom: spacing.md }}>
              <View style={styles.buildingHeader}>
                <View style={styles.buildingCode}>
                  <Small style={{ color: colors.white, fontWeight: '700' }}>{building.code}</Small>
                </View>
                <View style={{ flex: 1 }}>
                  <H3>{building.name}</H3>
                  <Small style={{ marginTop: 2 }}>
                    {building.floor_count ?? 0} floors · {building.room_count ?? 0} rooms
                    {building.has_elevator ? ' · lift' : ''}
                  </Small>
                </View>
                <Badge tone={building.status === 'operational' ? 'mint' : building.status === 'closed' ? 'coral' : 'signal'}>{building.status}</Badge>
              </View>
              <View style={styles.buildingActions}>
                <Small>Lat {building.lat.toFixed(4)}, lng {building.lng.toFixed(4)}</Small>
                <Pressable onPress={() => setQuery(building.code)}>
                  <Small style={{ color: colors.brand700, fontWeight: '700' }}>Show rooms →</Small>
                </Pressable>
              </View>
            </Card>
          ))}
        </View>
      ) : null}

      {searching ? (
        <View style={styles.padded}>
          {rooms.loading && !rooms.data ? <Loading label="Searching rooms…" /> : null}
          {rooms.error ? <ErrorNote message={rooms.error} onRetry={rooms.reload} /> : null}
          {rooms.data?.items.length === 0 ? (
            <Card>
              <H3>No rooms match “{query}”</H3>
              <Small style={{ marginTop: 4 }}>Try a building code such as A, B or C, or a room number like 204.</Small>
            </Card>
          ) : null}
          {rooms.data?.items.map((room) => (
            <Pressable key={room.id} onPress={() => router.push(`/room/${encodeURIComponent(room.code)}` as any)} style={styles.roomRow}>
              <View style={{ flex: 1 }}>
                <Small style={{ color: colors.ink800, fontWeight: '700' }}>{room.code}</Small>
                <Small>
                  {room.name} · {room.building_code ?? ''} {room.floor_name ?? ''} · seats {room.capacity}
                </Small>
              </View>
              {room.requires_admission ? <Badge tone="signal">queue</Badge> : null}
              <Ionicons name="chevron-forward" size={18} color={colors.ink400} />
            </Pressable>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { padding: spacing.lg },
  padded: { paddingHorizontal: spacing.lg },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.ink200,
    backgroundColor: colors.white,
    borderRadius: radius.control,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.ink800 },
  actions: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.md, marginBottom: spacing.lg },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  buildingHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  buildingCode: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.brand600,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buildingActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md },
  roomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.ink100,
    borderRadius: radius.card,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
});
