import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Loading } from '@/components/ui';
import { AuthProvider, useAuth } from '@/lib/auth';
import { registerForPush } from '@/lib/notifications';

void SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { user, ready } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    void SplashScreen.hideAsync();
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    const first = segments[0] as string | undefined;
    // Visitors on this device: the only thing a phone without a session can reach is the sign-in screen —
    // there is no public browsing layer here, because maps, buildings and events are the web's job.
    const inAuthGroup = first === '(auth)';
    if (!user && !inAuthGroup) router.replace('/login' as any);
    else if (user && inAuthGroup) router.replace('/' as any);
  }, [ready, user, segments, router]);

  useEffect(() => {
    if (!user) return;
    // Push registration is best-effort: Expo Go and simulators cannot always mint a token, and
    // the in-app notification centre works regardless.
    void registerForPush();
  }, [user]);

  if (!ready) {
    return (
      <SafeAreaProvider>
        <Loading label="Restoring your session…" />
      </SafeAreaProvider>
    );
  }

  return (
    // Three role trees, one switchboard above them (`app/index.tsx` sends a sign-in to its own root).
    // Each tree owns its navigation, so nothing here decides what a student "should also see".
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#f6f7fb' } }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="student" />
      <Stack.Screen name="staff" />
      <Stack.Screen name="admin" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
