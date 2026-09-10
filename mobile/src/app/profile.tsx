import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Badge, Button, Card, Eyebrow, H3, KeyValue, Screen, Small, Title } from '@/components/ui';
import { API_BASE, ApiError, authApi, positioningApi } from '@/lib/api';
import { useAuth, useLoader } from '@/lib/auth';
import { colors, radius, relativeTime, spacing } from '@/lib/theme';

export default function ProfileScreen() {
  const { user, refresh, signOut } = useAuth();
  const position = useLoader(() => positioningApi.current(), []);
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [department, setDepartment] = useState(user?.department ?? '');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await authApi.updateProfile({ name: name.trim(), phone: phone.trim() || null, department: department.trim() || null });
      await refresh();
      setNotice('Profile updated.');
    } catch (caught) {
      setError(caught instanceof ApiError ? (caught.firstError ?? caught.message) : 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Eyebrow>Account</Eyebrow>
        <Title style={{ marginTop: 2 }}>{user?.name ?? 'Profile'}</Title>
        <Small style={{ marginTop: 4 }}>{user?.email ?? ''}</Small>
        {user?.role_code ? <Badge tone={user.role_code === 'admin' ? 'coral' : user.role_code === 'staff' ? 'brand' : 'mint'}>{user.role_code}</Badge> : null}
      </View>

      <View style={styles.padded}>
        <Card>
          <H3>Your details</H3>
          {(
            [
              { label: 'Full name', value: name, set: setName },
              { label: 'Phone', value: phone, set: setPhone, placeholder: '+31 6 1234 5678' },
              { label: 'Department', value: department, set: setDepartment, placeholder: 'Computer Science' },
            ] as const
          ).map((field) => (
            <View key={field.label}>
              <Small style={{ marginTop: spacing.md, fontWeight: '600', color: colors.ink700 }}>{field.label}</Small>
              <TextInput
                value={field.value}
                onChangeText={field.set}
                placeholder={'placeholder' in field ? field.placeholder : undefined}
                placeholderTextColor={colors.ink400}
                style={styles.input}
                accessibilityLabel={field.label}
              />
            </View>
          ))}

          {notice ? <Small style={{ marginTop: spacing.md, color: colors.mint700, fontWeight: '600' }}>{notice}</Small> : null}
          {error ? <Small style={{ marginTop: spacing.md, color: colors.coral600, fontWeight: '600' }}>{error}</Small> : null}

          <Button label="Save changes" loading={saving} onPress={() => void save()} style={{ marginTop: spacing.lg }} />
        </Card>

        <Card style={{ marginTop: spacing.lg }}>
          <H3>Session & device</H3>
          <View style={{ marginTop: spacing.sm }}>
            <KeyValue label="Registration number" value={user?.registration_no ?? '—'} />
            <KeyValue label="Account created" value={user?.created_at ? relativeTime(user.created_at) : '—'} />
            <KeyValue label="API base" value={API_BASE} />
            <KeyValue label="Token storage" value="expo-secure-store" />
            <KeyValue
              label="Last position"
              value={position.data?.position ? `${position.data.position.source} · ${relativeTime(position.data.position.updated_at)}` : 'none this session'}
            />
          </View>
        </Card>

        <Card style={{ marginTop: spacing.lg }}>
          <H3>Notifications</H3>
          <Small style={{ marginTop: 4 }}>
            Push registration happens automatically on launch when the device allows it; the notification centre always works from the API. Manage permissions in your device settings.
          </Small>
        </Card>

        <Button label="Sign out" variant="danger" onPress={() => void signOut()} style={{ marginTop: spacing.lg }} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { padding: spacing.lg },
  padded: { paddingHorizontal: spacing.lg },
  input: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.ink200,
    borderRadius: radius.control,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.ink800,
    backgroundColor: colors.white,
  },
});
