import { Stack } from 'expo-router';

/**
 * The staff workspace on mobile: quick actions against the lines and desks you run, and nothing else.
 *
 * Deliberately absent here — and this is the part that matters for separation rather than looks:
 * there is no QR scanner for room entry, no "join a queue", no student timetable, no navigation.
 * A staff member standing in a corridor is calling the next ticket, not taking a place in a line; the
 * screens that would let them pretend otherwise are not in this tree, and `role:staff` on the API would
 * refuse them even if the files were added here by mistake.
 */
export default function StaffLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#f6f7fb' } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="line/[id]" options={{ headerShown: true, title: 'Line' }} />
      <Stack.Screen name="office/[id]" options={{ headerShown: true, title: 'Desk' }} />
    </Stack>
  );
}
