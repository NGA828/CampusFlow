import { TabIcon } from '@/components/visual';
import { useReducedMotion } from '@/components/motion';
import { Tabs } from 'expo-router';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
      <Tabs.Screen name="index" options={{ title: 'Monitoring', tabBarIcon: ({ color, focused }) => <TabIcon name="pulse-outline" color={color} focused={focused} /> }} />
      <Tabs.Screen name="alerts" options={{ title: 'Alerts', tabBarIcon: ({ color, focused }) => <TabIcon name="notifications-outline" color={color} focused={focused} /> }} />
    </Tabs>
  );
}
