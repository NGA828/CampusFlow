import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { colors } from '@/lib/theme';

/**
 * Staff navigation on a phone: three tabs, all of them about the line in front of you.
 *
 * There is no "student" tab, no map of the campus and no timetable here — not because a flag hides them,
 * but because this tree has no routes for them. The operational console (timetable, events, announcements,
 * service windows, analytics) is a web workspace at `/staff/*` in the browser, where a keyboard and a wide
 * screen are available.
 */
export default function StaffTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand600,
        tabBarInactiveTintColor: colors.ink400,
        tabBarStyle: { backgroundColor: colors.white, borderTopColor: colors.ink100 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Line', tabBarIcon: ({ color, size }) => <Ionicons name="pulse-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="desk" options={{ title: 'Desk', tabBarIcon: ({ color, size }) => <Ionicons name="id-card-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" color={color} size={size} /> }} />
    </Tabs>
  );
}
