import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import { Small } from './ui';
import { colors } from '@/lib/theme';
import type { Building } from '@/lib/types';

/** Schematic overview from API coordinates, never a substitute for the backend's walking route. */
export function CampusOverview({ buildings, onSelect }: { buildings: Building[]; onSelect: (code: string) => void }) {
  const points = buildings.filter((building) => Number.isFinite(Number(building.lat)) && Number.isFinite(Number(building.lng)) && building.lat != null && building.lng != null);
  if (!points.length) return null;
  const lat = points.map((point) => Number(point.lat));
  const lng = points.map((point) => Number(point.lng));
  const minLat = Math.min(...lat), maxLat = Math.max(...lat), minLng = Math.min(...lng), maxLng = Math.max(...lng);
  return <View style={{ backgroundColor: '#eaf2ed', borderRadius: 24, borderWidth: 1, borderColor: '#dce7df', overflow: 'hidden' }}>
    <View style={{ height: 236, margin: 24 }}>
      {[0, 1, 2, 3, 4].map((i) => <View key={i} pointerEvents="none" style={{ position: 'absolute', top: `${i * 25}%`, left: 0, right: 0, height: 1, backgroundColor: '#d9e5dd' }} />)}
      {[0, 1, 2, 3, 4].map((i) => <View key={i} pointerEvents="none" style={{ position: 'absolute', left: `${i * 25}%`, top: 0, bottom: 0, width: 1, backgroundColor: '#d9e5dd' }} />)}
      {points.map((point) => {
        const x = maxLng === minLng ? 50 : 12 + (Number(point.lng) - minLng) / (maxLng - minLng) * 76;
        const y = maxLat === minLat ? 50 : 18 + (maxLat - Number(point.lat)) / (maxLat - minLat) * 64;
        return <Pressable key={point.id} accessibilityRole="button" accessibilityLabel={`Show rooms in ${point.name}`} onPress={() => onSelect(point.code)} style={({ pressed }) => ({ position: 'absolute', left: `${x}%`, top: `${y}%`, transform: [{ translateX: -24 }, { translateY: -24 }], minWidth: 48, minHeight: 48, maxWidth: 80, padding: 8, borderRadius: 16, backgroundColor: pressed ? colors.brand700 : colors.brand600, borderWidth: 3, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' })}>
          <Ionicons name="business" size={16} color="white" /><Small style={{ color: colors.white, fontWeight: '800' }}>{point.code}</Small>
        </Pressable>;
      })}
      <View pointerEvents="none" style={{ position: 'absolute', right: -10, top: -10, alignItems: 'center' }}><Ionicons name="compass-outline" size={26} color={colors.mint700} /><Small>N</Small></View>
    </View>
    <View style={{ backgroundColor: '#f5f9f6', paddingHorizontal: 16, paddingVertical: 12 }}><Small style={{ color: colors.mint700 }}>Building overview · tap a pin to find rooms</Small><Small style={{ fontSize: 11 }}>Relative locations from campus data, not a walking route.</Small></View>
  </View>;
}
