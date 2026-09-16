import { TabIcon } from '@/components/visual';
import { useReducedMotion } from '@/components/motion';
import { Tabs } from 'expo-router';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
      <Tabs.Screen name="index" options={{ title: 'Line', tabBarIcon: ({ color, focused }) => <TabIcon name="pulse-outline" color={color} focused={focused} /> }} />
      <Tabs.Screen name="desk" options={{ title: 'Desk', tabBarIcon: ({ color, focused }) => <TabIcon name="id-card-outline" color={color} focused={focused} /> }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: ({ color, focused }) => <TabIcon name="settings-outline" color={color} focused={focused} /> }} />
    </Tabs>
  );
}
