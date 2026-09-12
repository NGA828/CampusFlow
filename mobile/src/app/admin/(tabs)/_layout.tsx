import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { colors } from '@/lib/theme';

/**
 * Administration on a phone: two tabs, and neither of them can change anything about the campus.
 *
 * The whole point of this tree is that an administrator away from a desk can still answer "is anything
 * broken right now" and "has anyone looked at it yet". Accounts, roles, rooms, floor plans, geofences, QR
 * nodes and queue policy are console work on the web, where there is room for a table and a form — and the
 * API refuses those verbs from this client regardless of what is added here.
 */
export default function AdminTabsLayout() {
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
      <Tabs.Screen name="index" options={{ title: 'Monitoring', tabBarIcon: ({ color, size }) => <Ionicons name="pulse-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="alerts" options={{ title: 'Alerts', tabBarIcon: ({ color, size }) => <Ionicons name="notifications-outline" color={color} size={size} /> }} />
    </Tabs>
  );
}
