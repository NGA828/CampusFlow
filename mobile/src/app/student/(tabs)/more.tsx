import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { Button, Card, H3, ListRow, Screen, SectionTitle, Small } from '@/components/ui';
import { HeroPanel, IconTile, PageIntro, ProfileCard, type IconName } from '@/components/visual';
import { useAuth } from '@/lib/auth';
import { colors } from '@/lib/theme';

const GROUPS: { title: string; links: { href: string; label: string; hint: string; icon: IconName }[] }[] = [
  { title: 'Campus essentials', links: [
    { href: '/student/offices', label: 'Administrative offices', hint: 'Find a desk and request a visit', icon: 'business-outline' },
    { href: '/student/scan', label: 'Scan a QR anchor', hint: 'Find your indoor starting point', icon: 'qr-code-outline' },
  ] },
  { title: 'Your space', links: [
    { href: '/student/notifications', label: 'Notifications', hint: 'The updates that matter to you', icon: 'notifications-outline' },
    { href: '/student/profile', label: 'Profile & settings', hint: 'Your details, devices and session', icon: 'person-outline' },
  ] },
];

export default function MoreScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  return <Screen bottomSafeArea={false}>
    <PageIntro eyebrow="Made for your campus day" title="A little more, for you." icon="grid-outline" />
    <View style={{ paddingHorizontal: 20, gap: 22 }}>
      <ProfileCard name={user?.name ?? 'Your account'} email={user?.email ?? ''} role="student" />
      <HeroPanel eyebrow="Meet your campus companion" title="A question? Start here." description="Rooms, routes or your next class. Ask CampusFlow in your own words." icon="sparkles-outline" style={{ backgroundColor: colors.brand700, borderColor: colors.brand700 }}>
        <Button label="Ask the campus assistant" variant="secondary" onPress={() => router.push('/student/assistant' as any)} />
      </HeroPanel>
      {GROUPS.map((group) => <View key={group.title}><SectionTitle title={group.title} /><Card style={{ paddingVertical: 4 }}>{group.links.map((link) => <ListRow key={link.href} onPress={() => router.push(link.href as any)} style={{ paddingVertical: 18 }}>
        <IconTile name={link.icon} tone={group.title === 'Your space' ? 'mint' : 'brand'} /><View style={{ flex: 1 }}><H3>{link.label}</H3><Small style={{ marginTop: 4 }}>{link.hint}</Small></View><Ionicons name="chevron-forward" size={18} color={colors.ink400} />
      </ListRow>)}</Card></View>)}
      <Button label="Sign out" variant="secondary" onPress={() => void signOut()} />
      <Small style={{ textAlign: 'center', color: colors.ink500 }}>CampusFlow · Navigate. Learn. Connect.</Small>
    </View>
  </Screen>;
}
