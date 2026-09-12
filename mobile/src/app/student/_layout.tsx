import { Stack } from 'expo-router';

/**
 * The student workspace on mobile — the real-time companion, not a smaller web app.
 *
 * Everything reachable from here is an act performed with the body in a place: scanning the code on a
 * wall, standing in a line, walking to a room, tapping "I'm here". Reading a week in detail, configuring
 * anything, or administering anyone is not in this tree, because the API will not accept it from a
 * student and the web is where those screens live.
 */
export default function StudentLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#f6f7fb' } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="timetable" options={{ headerShown: true, title: 'Timetable' }} />
      <Stack.Screen name="navigate/[code]" options={{ headerShown: true, title: 'Navigate' }} />
      <Stack.Screen name="room/[code]" options={{ headerShown: true, title: 'Room' }} />
      <Stack.Screen name="office/[code]" options={{ headerShown: true, title: 'Office' }} />
      <Stack.Screen name="offices" options={{ headerShown: true, title: 'Offices' }} />
      <Stack.Screen name="assistant" options={{ headerShown: true, title: 'Assistant' }} />
      <Stack.Screen name="notifications" options={{ headerShown: true, title: 'Notifications' }} />
      <Stack.Screen name="profile" options={{ headerShown: true, title: 'Profile' }} />
    </Stack>
  );
}
