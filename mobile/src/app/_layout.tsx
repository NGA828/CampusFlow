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
    const inAuthGroup = segments[0] === '(auth)';
    if (!user && !inAuthGroup) router.replace('/login');
    else if (user && inAuthGroup) router.replace('/');
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
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#f6f7fb' } }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="scan" options={{ presentation: 'modal' }} />
      <Stack.Screen name="assistant" />
      <Stack.Screen name="offices" />
      <Stack.Screen name="office/[code]" />
      <Stack.Screen name="room/[code]" />
      <Stack.Screen name="navigate/[code]" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="profile" />
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
