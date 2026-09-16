import { TabIcon } from '@/components/visual';
import { useReducedMotion } from '@/components/motion';
import { Tabs } from 'expo-router';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const reduced = useReducedMotion();
  const { fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: reduced ? 'none' : 'fade',
        tabBarActiveTintColor: colors.brand600,
        tabBarInactiveTintColor: colors.ink500,
        tabBarHideOnKeyboard: true,
        tabBarLabelPosition: 'below-icon',
        tabBarStyle: { height: 68 + Math.max(0, fontScale - 1) * 16 + insets.bottom, paddingTop: 6, paddingBottom: insets.bottom + 4, backgroundColor: colors.white, borderTopColor: colors.ink100 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: ({ color, focused }) => <TabIcon name="walk-outline" color={color} focused={focused} /> }} />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          tabBarIcon: ({ color, focused }) => <TabIcon name="qr-code-outline" color={color} focused={focused} />,
          tabBarBadgeStyle: { backgroundColor: colors.brand600 },
        }}
      />
      <Tabs.Screen name="map" options={{ title: 'Map', tabBarIcon: ({ color, focused }) => <TabIcon name="map-outline" color={color} focused={focused} /> }} />
      <Tabs.Screen name="queue" options={{ title: 'Line', tabBarIcon: ({ color, focused }) => <TabIcon name="people-outline" color={color} focused={focused} /> }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: ({ color, focused }) => <TabIcon name="grid-outline" color={color} focused={focused} /> }} />
    </Tabs>
  );
}
