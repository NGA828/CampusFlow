import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';

import { Body, Button, Card, Eyebrow, H3, Screen, Small, Title } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { colors, font, radius, spacing } from '@/lib/theme';

export default function RegisterScreen() {
  const { signUp } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', registration_no: '', department: '' });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const update = (key: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      await signUp({
        name: form.name.trim(),
        email: form.email,
        password: form.password,
        registration_no: form.registration_no.trim() || undefined,
        department: form.department.trim() || undefined,
      });
    } catch (caught) {
      setError(caught instanceof ApiError ? (caught.firstError ?? caught.message) : 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap}>
        <View style={styles.brand}>
          <Eyebrow>Student account</Eyebrow>
          <Title style={{ marginTop: spacing.sm }}>Join CampusFlow</Title>
          <Body style={{ marginTop: spacing.sm }}>Your timetable, room queues and campus services, in one place. It takes a moment.</Body>
        </View>

        <Card>
          {(
            [
              { key: 'name', label: 'Full name', placeholder: 'Amina Yusuf', autoCapitalize: 'words' },
              { key: 'email', label: 'Email', placeholder: 'you@campusflow.dev', autoCapitalize: 'none', keyboard: 'email-address' },
              { key: 'registration_no', label: 'Registration number (optional)', placeholder: 'STU-2026-014', autoCapitalize: 'characters' },
              { key: 'department', label: 'Department (optional)', placeholder: 'Computer Science', autoCapitalize: 'words' },
            ] as const
          ).map((field) => (
            <View key={field.key}>
              <H3 style={{ marginTop: spacing.lg }}>{field.label}</H3>
              <TextInput
                value={form[field.key]}
                onChangeText={update(field.key)}
                placeholder={field.placeholder}
                placeholderTextColor={colors.ink400}
                autoCapitalize={field.autoCapitalize}
                keyboardType={'keyboard' in field && field.keyboard ? 'email-address' : 'default'}
                style={styles.input}
                accessibilityLabel={field.label}
              />
            </View>
          ))}

          <H3 style={{ marginTop: spacing.lg }}>Password</H3>
          <TextInput
            value={form.password}
            onChangeText={update('password')}
            placeholder="At least 8 characters"
            placeholderTextColor={colors.ink400}
            secureTextEntry
            style={styles.input}
            accessibilityLabel="Password"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            label="Create account"
            loading={loading}
            onPress={() => void submit()}
            disabled={form.name.trim().length < 2 || !form.email.includes('@') || form.password.length < 8}
            style={{ marginTop: spacing.lg }}
          />

          <View style={styles.links}>
            <Small>Already registered? </Small>
            <Link href="/login">
              <Text style={styles.link}>Sign in</Text>
            </Link>
          </View>
        </Card>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: spacing.lg, gap: spacing.lg },
  brand: { paddingTop: spacing.xl },
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
