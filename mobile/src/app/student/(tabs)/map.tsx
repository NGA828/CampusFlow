import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Badge, Button, Card, EmptyState, ErrorNote, H3, Loading, Screen, SectionTitle, Small } from '@/components/ui';
import { IconTile, Notice, PageIntro } from '@/components/visual';
import { CampusOverview } from '@/components/campus-overview';
import { campusApi, positioningApi } from '@/lib/api';
import { useLoader } from '@/lib/auth';
import { colors, relativeTime } from '@/lib/theme';

export default function MapScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [term, setTerm] = useState('');
  useEffect(() => { const timer = setTimeout(() => setTerm(query.trim()), 250); return () => clearTimeout(timer); }, [query]);
  const buildings = useLoader(() => campusApi.buildings(), []);
  const matchedBuilding = term ? buildings.data?.buildings.find((building) => building.code.toLowerCase() === term.toLowerCase() || building.name.toLowerCase() === term.toLowerCase()) : undefined;
  const matchingBuildings = term ? buildings.data?.buildings.filter((building) => `${building.code} ${building.name}`.toLowerCase().includes(term.toLowerCase())) ?? [] : [];
  const rooms = useLoader(async () => {
    if (!term) return { items: [] };
    // The room-search endpoint only matches room names/codes, not building membership.
    if (matchedBuilding) return { items: (await campusApi.building(matchedBuilding.id)).rooms };
    return campusApi.rooms({ q: term, per_page: 30 });
  }, [term, matchedBuilding?.id]);
  const position = useLoader(() => positioningApi.current(), []);
  const searching = query.trim().length > 0;

  return (
    <Screen bottomSafeArea={false} onRefresh={() => { void buildings.reload(); void rooms.reload(); void position.reload(); }} refreshing={buildings.loading || position.loading || rooms.loading}>
      <PageIntro eyebrow="Explore campus" title="Your next place, found." description="From lecture halls to the quiet study spot. Start with a room or building." icon="map-outline" />
      <View style={styles.content}>
        <View style={styles.search}>
          <Ionicons name="search-outline" size={21} color={colors.brand600} />
          <TextInput value={query} onChangeText={setQuery} placeholder="Room, building or destination" placeholderTextColor={colors.ink400} style={styles.input} accessibilityLabel="Search rooms" autoCapitalize="characters" />
          {query ? <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery('')} style={styles.clear}><Ionicons name="close-circle" size={22} color={colors.ink400} /></Pressable> : null}
        </View>

        {!searching && buildings.data ? <CampusOverview buildings={buildings.data.buildings} onSelect={setQuery} /> : null}
        <Notice icon="locate-outline" title={position.data?.position ? 'Your location is anchored' : 'Find your indoor position'} tone="mint">
          {position.data?.position ? `${position.data.position.source} · updated ${relativeTime(position.data.position.updated_at)}` : 'Scan a QR anchor for a trusted starting point inside a building.'}
        </Notice>
        <Button label="Scan a location code" variant="secondary" onPress={() => router.push('/student/scan' as any)} />
        {position.error ? <ErrorNote message={position.error} onRetry={position.reload} /> : null}

        {searching ? <>
          {!matchedBuilding && matchingBuildings.length > 0 ? <View style={{ gap: 10 }}><SectionTitle title="Matching buildings" />{matchingBuildings.map((building) => <Button key={building.id} label={`${building.code} · ${building.name}`} variant="secondary" onPress={() => setQuery(building.code)} />)}</View> : null}
          <SectionTitle title={matchedBuilding ? `Rooms in ${matchedBuilding.code}` : 'Matching rooms'} action={rooms.data && term === query.trim() ? <Badge>{rooms.data.items.length} shown</Badge> : undefined} />
          {rooms.loading || term !== query.trim() ? <Loading label="Searching rooms…" /> : rooms.error ? <ErrorNote message={rooms.error} onRetry={rooms.reload} /> : <>
            {rooms.data?.items.length === 0 ? <EmptyState title="No rooms found" description="Try a room number, name or building code." /> : null}
            {rooms.data?.items.map((room) => <Pressable key={room.id} accessibilityRole="button" onPress={() => router.push(`/student/room/${encodeURIComponent(room.code)}` as any)} style={({ pressed }) => [styles.room, { opacity: pressed ? .75 : 1 }]}>
              <IconTile name="location-outline" size={42} /><View style={{ flex: 1 }}><H3>{room.code} · {room.name}</H3><Small style={{ marginTop: 5 }}>{room.building_code} · {room.floor_name} · {room.capacity} seats</Small>{room.requires_admission ? <Badge tone="signal">Admission queue</Badge> : null}</View><Ionicons name="chevron-forward" size={18} color={colors.ink400} />
            </Pressable>)}
          </>}
        </> : <>
          <SectionTitle title="Around campus" action={buildings.data ? <Badge>{buildings.data.buildings.length} buildings</Badge> : undefined} />
          {buildings.error ? <ErrorNote message={buildings.error} onRetry={buildings.reload} /> : null}
          {buildings.loading && !buildings.data ? <Loading label="Loading buildings…" /> : null}
          {buildings.data?.buildings.length === 0 ? <EmptyState title="The campus directory is quiet" description="Buildings will appear here when they are published by your campus." /> : null}
          {buildings.data?.buildings.map((building) => <Card key={building.id}>
            <View style={styles.buildingHeading}><IconTile name="business-outline" tone="mint" /><View style={{ flex: 1 }}><Small style={{ color: colors.brand700, fontWeight: '700' }}>BUILDING {building.code}</Small><H3 style={{ marginTop: 4 }}>{building.name}</H3></View></View>
            <View style={styles.meta}><Badge tone={building.status === 'operational' ? 'mint' : building.status === 'closed' ? 'coral' : 'signal'}>{building.status}</Badge><Small>{building.floor_count ?? '—'} floors · {building.room_count ?? '—'} rooms{building.has_elevator ? ' · lift' : ''}</Small></View>
            <Button label={`Explore ${building.code} rooms`} variant="secondary" onPress={() => setQuery(building.code)} style={{ marginTop: 16 }} />
          </Card>)}
        </>}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 16 },
  search: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: colors.ink200, backgroundColor: colors.white, borderRadius: 18, paddingLeft: 16, paddingRight: 6 },
  input: { flex: 1, minWidth: 0, fontSize: 16, color: colors.ink800, paddingVertical: 15 },
  clear: { width: 44, minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  buildingHeading: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 16 },
  room: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.ink100, borderRadius: 22, padding: 16 },
});
