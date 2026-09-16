/**
 * Shared UI primitives for the mobile app. Every screen composes these so spacing, colour and
 * state handling stay consistent (and match the web app's `components/ui/kit.tsx`).
 */
import { Children, isValidElement, useContext, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HeaderHeightContext, HeaderShownContext } from 'expo-router/react-navigation';

import { colors, font, radius, shadow, spacing } from '../lib/theme';
import { Ionicons } from '@expo/vector-icons';
import { ScreenEntrance } from './motion';
import { rowLayout } from '../lib/responsive';

export function Screen({
  children,
  onRefresh,
  refreshing,
  scroll = true,
  maxWidth = 720,
  bottomSafeArea = true,
  keyboardOffset,
  style,
}: {
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  scroll?: boolean;
  maxWidth?: number;
  bottomSafeArea?: boolean;
  keyboardOffset?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const headerHeight = useContext(HeaderHeightContext) ?? 0;
  const headerShown = useContext(HeaderShownContext);
  const content = <ScreenEntrance style={[styles.screenInner, { maxWidth }, !scroll && { flex: 1 }, style]}>{children}</ScreenEntrance>;
  return (
    <SafeAreaView style={styles.screen} edges={[...(!headerShown ? ['top' as const] : []), ...(bottomSafeArea ? ['bottom' as const] : []), 'left', 'right']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={keyboardOffset ?? (headerShown ? headerHeight : 0)}>
        {scroll ? (
          <ScrollView
            style={{ flex: 1 }}
            keyboardDismissMode="on-drag"
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            refreshControl={onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={colors.brand600} /> : undefined}
          >
            {content}
          </ScrollView>
        ) : (
          content
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Measure the row itself: tablet split-screen and nested cards need container, not screen width. */
export function AdaptiveRow({ children, style, minItemWidth = 140 }: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  minItemWidth?: number;
}) {
  const [width, setWidth] = useState(0);
  const { fontScale } = useWindowDimensions();
  const items = Children.toArray(children);
  const { itemWidth } = rowLayout(width, fontScale, minItemWidth, spacing.sm, items.length);
  return (
    <View style={style}>
      <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={styles.adaptiveRow}>
        {items.map((child, index) => (
          <View key={isValidElement(child) ? child.key ?? index : index} style={{ width: width ? itemWidth : '100%', minWidth: 0 }}>{child}</View>
        ))}
      </View>
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Title({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text accessibilityRole="header" style={[font.title, styles.ink900, style]}>{children}</Text>;
}

export function H2({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text accessibilityRole="header" style={[font.h2, styles.ink900, style]}>{children}</Text>;
}

export function H3({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text accessibilityRole="header" style={[font.h3, styles.ink800, style]}>{children}</Text>;
}

export function Body({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[font.body, styles.ink600, style]}>{children}</Text>;
}

export function Small({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[font.small, styles.ink500, style]}>{children}</Text>;
}

export function Eyebrow({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[font.tiny, styles.eyebrow, style]}>{children}</Text>;
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionTitle}>
      <H3>{title}</H3>
      {action}
    </View>
  );
}

const TONES = {
  brand: { bg: colors.brand100, fg: colors.brand700 },
  mint: { bg: colors.mint100, fg: colors.mint700 },
  signal: { bg: colors.signal100, fg: colors.signal700 },
  coral: { bg: colors.coral100, fg: colors.coral600 },
  neutral: { bg: colors.ink100, fg: colors.ink600 },
} as const;

export type Tone = keyof typeof TONES;

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: Tone }) {
  const palette = TONES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      <Text style={[font.small, { color: palette.fg, fontWeight: '600' }]}>{children}</Text>
    </View>
  );
}

export function Stat({ label, value, hint, tone = 'neutral' }: { label: string; value: string | number; hint?: string; tone?: Tone }) {
  return (
    <View style={[styles.stat, { backgroundColor: tone === 'neutral' ? colors.white : TONES[tone].bg }]}>
      <Text style={[font.tiny, { color: TONES[tone].fg, fontWeight: '600', textTransform: 'uppercase' }]}>{label}</Text>
      <Text style={[font.h2, { fontSize: 28, fontVariant: ['tabular-nums'], letterSpacing: -.7, color: tone === 'neutral' ? colors.ink900 : TONES[tone].fg, marginTop: 4 }]}>{value}</Text>
      {hint ? <Text style={[font.small, styles.ink500, { marginTop: 2 }]}>{hint}</Text> : null}
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const palette =
    variant === 'primary'
      ? { bg: colors.brand600, fg: colors.white, border: colors.brand600 }
      : variant === 'danger'
        ? { bg: colors.coral500, fg: colors.white, border: colors.coral500 }
        : variant === 'secondary'
          ? { bg: colors.white, fg: colors.ink800, border: colors.ink200 }
          : { bg: 'transparent', fg: colors.brand700, border: 'transparent' };

  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(isDisabled), busy: Boolean(loading) }}
      onPress={isDisabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={palette.fg} /> : <Text style={[font.h3, { color: palette.fg, flexShrink: 1, textAlign: 'center' }]}>{label}</Text>}
    </Pressable>
  );
}

export function KeyValue({ label, value, tone }: { label: string; value: string | number; tone?: Tone }) {
  return (
    <View style={styles.keyValue}>
      <Text style={[font.small, styles.ink500, { flexShrink: 1 }]}>{label}</Text>
      <Text style={[font.body, { flexShrink: 1, textAlign: 'right', fontWeight: '600', color: tone ? TONES[tone].fg : colors.ink800 }]}>{value}</Text>
    </View>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <Card style={styles.empty}>
      <View style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: colors.brand50, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}><Ionicons name="layers-outline" size={24} color={colors.brand600} /></View>
      <H3>{title}</H3>
      {description ? <Small style={{ marginTop: 6 }}>{description}</Small> : null}
    </Card>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card style={{ borderColor: colors.coral100, backgroundColor: colors.coral100 }}>
      <H3 style={{ color: colors.coral600 }}>Something went wrong</H3>
      <Small style={{ color: colors.coral600, marginTop: 4 }}>{message}</Small>
      {onRetry ? <Button label="Try again" variant="secondary" onPress={onRetry} style={{ marginTop: spacing.md }} /> : null}
    </Card>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.brand600} />
      <Small style={{ marginTop: spacing.sm }}>{label}</Small>
    </View>
  );
}

export function ProgressBar({ value, tone = 'brand' }: { value: number; tone?: 'brand' | 'mint' | 'signal' }) {
  const width = `${Math.max(2, Math.min(100, value))}%` as const;
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width, backgroundColor: tone === 'mint' ? colors.mint500 : tone === 'signal' ? colors.signal400 : colors.brand500 }]} />
    </View>
  );
}

export function ListRow({ children, onPress, style }: { children: ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  if (!onPress) return <View style={[styles.listRow, style]}>{children}</View>;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.listRow, { opacity: pressed ? 0.7 : 1 }, style]}>
      {children}
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink50 },
  // Phones use the full width; tablets get a centred column so cards do not stretch edge to edge.
  screenInner: { width: '100%', alignSelf: 'center', minWidth: 0 },
  scrollContent: { flexGrow: 1, paddingBottom: spacing.xxl },
  adaptiveRow: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  card: {
    minWidth: 0,
    backgroundColor: colors.white,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.ink100,
    padding: spacing.lg,
    ...shadow.card,
  },
  ink900: { color: colors.ink900 },
  ink800: { color: colors.ink800 },
  ink600: { color: colors.ink600 },
  ink500: { color: colors.ink500 },
  eyebrow: { color: colors.brand700, fontWeight: '700', textTransform: 'uppercase' },
  sectionTitle: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  badge: { maxWidth: '100%', flexShrink: 1, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill },
  stat: { flex: 1, minWidth: 0, borderWidth: 1, borderColor: colors.ink100, borderRadius: radius.card, padding: spacing.md },
  button: {
    minHeight: 48,
    minWidth: 48,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.control,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyValue: { gap: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 7 },
  empty: { alignItems: 'flex-start' },
  loading: { alignItems: 'center', paddingVertical: spacing.xl },
  progressTrack: { height: 8, borderRadius: radius.pill, backgroundColor: colors.ink100, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radius.pill },
  listRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.ink100,
  },
});
