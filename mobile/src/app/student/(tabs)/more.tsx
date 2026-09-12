import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Badge, Button, Card, Eyebrow, H3, ListRow, Screen, Small, Title } from '@/components/ui';
import { API_BASE } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { colors, spacing } from '@/lib/theme';

const LINKS = [
  { href: '/student/offices', label: 'Administrative offices', hint: "Principal's Office, Student Affairs, Registrar…", icon: 'business-outline' },
  { href: '/student/scan', label: 'Scan a QR anchor', hint: 'Fix your indoor position or check in', icon: 'qr-code-outline' },
  { href: '/student/assistant', label: 'Campus assistant', hint: 'Ask for a room, route or the shortest queue', icon: 'sparkles-outline' },
  { href: '/student/notifications', label: 'Notifications', hint: 'Class reminders, ticket calls, announcements', icon: 'notifications-outline' },
  { href: '/student/profile', label: 'Profile & settings', hint: 'Your details, device and session', icon: 'person-outline' },
] as const;

export default function MoreScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();

  return (
    <Screen>
      <View style={styles.header}>
        <Eyebrow>More</Eyebrow>
        <Title style={{ marginTop: 2 }}>{user?.name ?? 'Your account'}</Title>
        <Small style={{ marginTop: 4 }}>{user?.email ?? ''}</Small>
        {user?.role_code ? <Badge tone={user.role_code === 'admin' ? 'coral' : user.role_code === 'staff' ? 'brand' : 'mint'}>{user.role_code}</Badge> : null}
      </View>

      <View style={styles.padded}>
        <Card>
          {LINKS.map((link) => (
            <ListRow key={link.href} onPress={() => router.push(link.href as any)}>
              <View style={styles.rowLeft}>
                <Ionicons name={link.icon} size={19} color={colors.brand700} />
                <View style={{ flex: 1 }}>
                  <Small style={{ color: colors.ink800, fontWeight: '600' }}>{link.label}</Small>
                  <Small style={{ marginTop: 2 }}>{link.hint}</Small>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.ink400} />
            </ListRow>
          ))}
        </Card>

        <Card style={{ marginTop: spacing.lg }}>
          <H3>About this build</H3>
          <Small style={{ marginTop: 4 }}>
            CampusFlow mobile · Expo SDK 57. The API base is {API_BASE}. Sessions are stored in the device keychain and validated against the API on every launch.
          </Small>
          <Button label="Sign out" variant="danger" onPress={() => void signOut()} style={{ marginTop: spacing.lg }} />
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { padding: spacing.lg },
  padded: { paddingHorizontal: spacing.lg },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
});
