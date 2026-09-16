import { useReducedMotion } from '@/components/motion';
import { Stack } from 'expo-router';

/**
 * The admin workspace on mobile: monitoring and alerts only.
 *
 * Configuration — accounts, rooms, geometry, queue policy — is desktop work, and the phone tree has no
 * form for it on purpose. What belongs in a pocket is "is anything on fire right now", answered by the
 * derived alert feed and the summary counts, plus a mute on a condition you are already handling.
 */
export default function AdminLayout() {
  const reduced = useReducedMotion();
  return (
    <Stack screenOptions={{ animation: reduced ? 'none' : 'slide_from_right', headerShown: false, contentStyle: { backgroundColor: '#f6f7fb' } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="alert/[key]" options={{ headerShown: true, title: 'Alert' }} />
    </Stack>
  );
}
