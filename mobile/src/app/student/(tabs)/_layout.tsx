import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { colors } from '@/lib/theme';

/**
 * The student's phone: five tabs, all of them about being somewhere.
 *
 * Today answers "where am I supposed to be, and how long until". Scan puts a code on a wall into the app.
 * Map walks you to the door. Line is where you are standing. More holds the things that are still *yours*
 * — offices, assistant, notifications, profile.
 *
 * A week-by-week timetable grid, course lists, room availability searches and analytics are the web
 * client's screens: same role, different platform, because reading a week and deciding where to walk are
 * different jobs. Nothing is hidden here with a condition; the routes are not in this tree, and
 * `role:student` plus the mobile-only permissions on the API would refuse them anyway.
 */
export default function StudentTabsLayout() {
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
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: ({ color, size }) => <Ionicons name="walk-outline" color={color} size={size} /> }} />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          tabBarIcon: ({ color, size }) => <Ionicons name="qr-code-outline" color={color} size={size} />,
          tabBarBadgeStyle: { backgroundColor: colors.brand600 },
        }}
      />
      <Tabs.Screen name="map" options={{ title: 'Map', tabBarIcon: ({ color, size }) => <Ionicons name="map-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="queue" options={{ title: 'Line', tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" color={color} size={size} /> }} />
    </Tabs>
  );
}
