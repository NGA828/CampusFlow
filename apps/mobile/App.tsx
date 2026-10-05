import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { SessionProvider, useSession } from './src/session';
import { LoginScreen } from './src/screens/LoginScreen';
import { TodayScreen } from './src/screens/TodayScreen';
import { ScanScreen } from './src/screens/ScanScreen';
import { MapScreen } from './src/screens/MapScreen';
import { BookingsScreen } from './src/screens/BookingsScreen';
import { colours, styles } from './src/theme';
import type { Position } from './src/types';

/**
 * CampusFlow student app.
 *
 * Four tabs, held in local state rather than a navigation library: the student
 * experience is a small, flat set of screens, and the indoor position is shared
 * between Scan and Map, so one owner for that state keeps the behaviour obvious.
 */

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});

const TABS = [
  { id: 'today', label: 'Aujourd’hui' },
  { id: 'scan', label: 'Scanner' },
  { id: 'map', label: 'Carte' },
  { id: 'rooms', label: 'Salles' },
] as const;

type TabId = (typeof TABS)[number]['id'];

function Shell() {
  const { user, loading } = useSession();
  const [tab, setTab] = useState<TabId>('today');
  const [position, setPosition] = useState<Position | null>(null);

  // Time-sensitive guidance is delivered as a local notification; a push token would be
  // registered here too once a project id is configured for this build.
  useEffect(() => {
    void Notifications.requestPermissionsAsync();
  }, []);

  if (loading) {
    return (
      <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colours.brand} />
      </View>
    );
  }

  if (!user) return <LoginScreen />;

  return (
    <View style={styles.screen}>
      <View style={{ flex: 1 }}>
        {tab === 'today' ? <TodayScreen /> : null}
        {tab === 'scan' ? (
          <ScanScreen
            position={position}
            onPosition={(fixed) => {
              setPosition(fixed);
              void Notifications.scheduleNotificationAsync({
                content: { title: 'Position fixée', body: `${fixed.label} — ${fixed.floorName}` },
                trigger: null,
              });
            }}
          />
        ) : null}
        {tab === 'map' ? <MapScreen position={position} /> : null}
        {tab === 'rooms' ? <BookingsScreen /> : null}
      </View>
      <View style={styles.tabBar}>
        {TABS.map((entry) => (
          <Pressable
            key={entry.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === entry.id }}
            style={styles.tab}
            onPress={() => setTab(entry.id)}
          >
            <View style={[styles.tabDot, tab === entry.id && styles.tabDotActive]} />
            <Text style={[styles.tabLabel, tab === entry.id && styles.tabLabelActive]}>{entry.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <SessionProvider>
        <Shell />
      </SessionProvider>
    </SafeAreaView>
  );
}
