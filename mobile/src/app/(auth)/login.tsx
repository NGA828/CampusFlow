import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';

import { Body, Button, Card, Eyebrow, H3, Screen, Small, Title } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { colors, font, radius, spacing } from '@/lib/theme';

const DEMO = [
  { label: 'Student', email: 'student@campusflow.dev' },
  { label: 'Staff', email: 'staff@campusflow.dev' },
  { label: 'Admin', email: 'admin@campusflow.dev' },
];

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (caught) {
      setError(caught instanceof ApiError ? (caught.firstError ?? caught.message) : 'Sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap}>
        <View style={styles.brand}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>CF</Text>
          </View>
          <Eyebrow>Navigate. Learn. Connect.</Eyebrow>
          <Title style={{ marginTop: spacing.sm }}>Welcome back to CampusFlow</Title>
          <Body style={{ marginTop: spacing.sm }}>Sign in with your campus account to see your timetable, queues and routes.</Body>
        </View>

        <Card>
          <H3>Email</H3>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@campusflow.dev"
            placeholderTextColor={colors.ink400}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            style={styles.input}
            accessibilityLabel="Email address"
          />

          <H3 style={{ marginTop: spacing.lg }}>Password</H3>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.ink400}
            secureTextEntry
            style={styles.input}
            accessibilityLabel="Password"
            onSubmitEditing={() => void submit()}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            label="Sign in"
            loading={loading}
            onPress={() => void submit()}
            disabled={email.length < 4 || password.length < 6}
            style={{ marginTop: spacing.lg }}
          />

          <View style={styles.links}>
            <Small>New here? </Small>
            <Link href="/register">
              <Text style={styles.link}>Create an account</Text>
            </Link>
          </View>
        </Card>

        <Card style={{ marginTop: spacing.lg }}>
          <H3>Demo accounts</H3>
          <Small style={{ marginTop: 4 }}>Seeded campus accounts — password CampusFlow2026!</Small>
          <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
            {DEMO.map((account) => (
              <Button
                key={account.email}
                label={`${account.label} · ${account.email}`}
                variant="secondary"
                onPress={() => {
                  setEmail(account.email);
                  setPassword('CampusFlow2026!');
                }}
              />
            ))}
          </View>
        </Card>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: spacing.lg, gap: spacing.lg },
  brand: { paddingTop: spacing.xl },
  logo: { width: 46, height: 46, borderRadius: 14, backgroundColor: colors.brand600, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  logoText: { color: colors.white, fontWeight: '700', fontSize: 17 },
  input: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.ink200,
    borderRadius: radius.control,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: font.body.fontSize,
    color: colors.ink800,
    backgroundColor: colors.white,
  },
  error: { marginTop: spacing.md, color: colors.coral600, fontSize: font.small.fontSize },
  links: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg },
  link: { color: colors.brand600, fontWeight: '600', fontSize: font.small.fontSize },
});
