import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View, type ColorValue, type StyleProp, type ViewStyle } from 'react-native';
import type { ComponentProps, ReactNode } from 'react';
import { Badge, Body, Card, Eyebrow, H2, H3, Small, Title } from './ui';
import { colors, font, spacing } from '@/lib/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];
export const campusArt = require('../../assets/images/campus-welcome.webp');
export const visual = StyleSheet.create({
  page: { paddingHorizontal: 20, gap: 20, paddingTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  section: { marginTop: 20, marginBottom: 12 },
  dark: { backgroundColor: colors.ink900, borderColor: colors.ink900, padding: 22, borderRadius: 24 },
  lightText: { color: '#c7cde5' },
  whiteText: { color: colors.white },
  divider: { borderTopWidth: 1, borderTopColor: colors.ink100, marginVertical: 16 },
});

export function IconTile({ name, tone = 'brand', size = 46 }: { name: IconName; tone?: 'brand' | 'mint' | 'signal' | 'coral' | 'ink'; size?: number }) {
  const palettes = { brand: [colors.brand50, colors.brand600], mint: [colors.mint100, colors.mint700], signal: [colors.signal100, colors.signal700], coral: [colors.coral100, colors.coral600], ink: [colors.ink800, '#c3ccff'] };
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size, flexShrink: 0, borderRadius: size * .32, backgroundColor: palettes[tone][0], alignItems: 'center', justifyContent: 'center' }}><Ionicons name={name} size={size * .46} color={palettes[tone][1]} /></View>;
}

export function PageIntro({ eyebrow, title, description, icon, trailing }: { eyebrow: string; title: string; description?: string; icon: IconName; trailing?: ReactNode }) {
  return <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 22, gap: 14 }}>
    <View style={[visual.row, { justifyContent: 'space-between' }]}><View style={[visual.row, { flex: 1, minWidth: 0 }]}><IconTile name={icon} size={34} /><Eyebrow style={{ flexShrink: 1 }}>{eyebrow}</Eyebrow></View>{trailing}</View>
    <View><Title>{title}</Title>{description ? <Body style={{ marginTop: 6 }}>{description}</Body> : null}</View>
  </View>;
}

export function HeroPanel({ eyebrow, title, description, icon, children, style }: { eyebrow: string; title: string; description?: string; icon: IconName; children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <Card style={[visual.dark, style]}>
    <View style={[visual.row, { justifyContent: 'space-between', marginBottom: 14 }]}><Text style={[font.tiny, { color: '#b8b9ff', fontWeight: '700', textTransform: 'uppercase', flexShrink: 1 }]}>{eyebrow}</Text><IconTile name={icon} tone="ink" size={40} /></View>
    <H2 style={{ color: colors.white, fontSize: 26, letterSpacing: -.5 }}>{title}</H2>
    {description ? <Small style={{ color: '#c7cde5', marginTop: 8, lineHeight: 21 }}>{description}</Small> : null}
    {children ? <View style={{ marginTop: 18 }}>{children}</View> : null}
  </Card>;
}

export function CampusMoment() {
  return <View style={{ backgroundColor: colors.brand50, borderRadius: 24, overflow: 'hidden' }}>
    <Image source={campusArt} contentFit="cover" style={{ width: '100%', aspectRatio: 2.3 }} accessible={false} />
    <View style={{ padding: 18, paddingTop: 4 }}><Eyebrow>Navigate. Learn. Connect.</Eyebrow><H3 style={{ marginTop: 6 }}>A little less searching. A lot more campus.</H3></View>
  </View>;
}

export function FeatureLink({ icon, title, hint, onPress, tone = 'brand' }: { icon: IconName; title: string; hint: string; onPress: () => void; tone?: 'brand' | 'mint' | 'signal' }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ backgroundColor: colors.white, borderWidth: 1, borderColor: colors.ink100, borderRadius: 20, padding: 16, minHeight: 128, gap: 12, opacity: pressed ? .8 : 1 })}>
    <View style={[visual.row, { justifyContent: 'space-between' }]}><IconTile name={icon} tone={tone} size={38} /><Ionicons name="arrow-forward-outline" size={17} color={colors.ink400} /></View>
    <View><H3>{title}</H3><Small style={{ marginTop: 3 }}>{hint}</Small></View>
  </Pressable>;
}

export function Notice({ icon = 'information-circle-outline', title, children, tone = 'brand' }: { icon?: IconName; title: string; children?: ReactNode; tone?: 'brand' | 'mint' | 'signal' | 'coral' }) {
  return <View style={{ backgroundColor: tone === 'mint' ? '#e9faf6' : tone === 'signal' ? '#fff8ea' : tone === 'coral' ? '#fff0f1' : colors.brand50, borderRadius: 20, padding: 16, flexDirection: 'row', gap: 12 }}>
    <IconTile name={icon} tone={tone} size={36} /><View style={{ flex: 1, minWidth: 0 }}><H3>{title}</H3>{children ? <Small style={{ marginTop: 4 }}>{children}</Small> : null}</View>
  </View>;
}

export function ProfileCard({ name, email, role }: { name: string; email: string; role: string }) {
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('');
  return <Card style={visual.dark}>
    <View style={visual.row}><View style={{ backgroundColor: '#c3ccff', borderRadius: 20, width: 60, height: 60, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 21, fontWeight: '800', color: colors.brand700 }}>{initials}</Text></View><Badge tone={role === 'staff' ? 'mint' : 'brand'}>{role} account</Badge></View>
    <H2 style={{ color: colors.white, marginTop: 20 }}>{name}</H2><Small style={{ color: '#c7cde5', marginTop: 5 }}>{email}</Small>
  </Card>;
}

/** Actual status only: the rail does not estimate a queue position or fabricate progress. */
export function TicketStatus({ status }: { status: string }) {
  return <View style={{ borderTopWidth: 1, borderStyle: 'dashed', borderTopColor: colors.ink200, marginTop: 18, paddingTop: 16, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
    <IconTile name={status === 'called' ? 'megaphone-outline' : status === 'checked_in' ? 'checkmark-circle-outline' : 'ticket-outline'} tone={status === 'called' ? 'signal' : 'brand'} size={40} />
    <View style={{ flex: 1 }}><Eyebrow>Ticket status</Eyebrow><H3 style={{ marginTop: 3 }}>{status.replaceAll('_', ' ')}</H3></View>
  </View>;
}

/** Expo owns tab semantics; only the visual icon treatment is customised here. */
export function TabIcon({ name, focused, color }: { name: IconName; focused: boolean; color: ColorValue }) {
  return <View style={{ width: 54, height: 32, borderRadius: 13, backgroundColor: focused ? colors.brand50 : 'transparent', alignItems: 'center', justifyContent: 'center' }}><Ionicons name={name} size={22} color={color} /></View>;
}
