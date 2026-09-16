import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Body, Button, Card, Eyebrow, H2, Screen, Small, Title } from '@/components/ui';
import { campusArt, IconTile } from '@/components/visual';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { colors, font } from '@/lib/theme';

const DEMO = [
  { label: 'Student', email: 'student@campusflow.edu' },
  { label: 'Staff', email: 'staff@campusflow.edu' },
  { label: 'Admin', email: 'admin@campusflow.edu' },
];

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);

  const submit = async () => {
    if (loading || email.trim().length < 4 || password.length < 6) return;
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
    <Screen maxWidth={560}>
      <View style={styles.page}>
        <View style={styles.brand}>
          <View style={styles.logo}><Ionicons name="navigate" color="white" size={22} /></View>
          <View><Text style={styles.wordmark}>CampusFlow</Text><Small>Navigate. Learn. Connect.</Small></View>
        </View>

        <View style={styles.welcome}>
          <Image source={campusArt} contentFit="cover" style={styles.art} accessible={false} />
          <View style={styles.welcomeCopy}>
            <Eyebrow>One campus. So many possibilities.</Eyebrow>
            <Title style={{ marginTop: 8 }}>Your campus,{ '\n' }in your pocket.</Title>
            <Body style={{ marginTop: 8 }}>Find your next class. Skip the guesswork. Make every campus day yours.</Body>
          </View>
        </View>

        <Card style={{ padding: 22 }}>
          <View style={[styles.brand, { marginBottom: 20 }]}><IconTile name="log-in-outline" size={38} /><View><H2>Welcome back</H2><Small>Sign in with your campus account.</Small></View></View>
          <Text style={styles.label}>Email address</Text>
          <View style={[styles.field, focused === 'email' && styles.focused]}>
            <Ionicons name="mail-outline" color={colors.ink400} size={19} />
            <TextInput value={email} onChangeText={setEmail} placeholder="you@campusflow.edu" placeholderTextColor={colors.ink400}
              autoCapitalize="none" autoCorrect={false} autoComplete="email" keyboardType="email-address" returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()} onFocus={() => setFocused('email')} onBlur={() => setFocused(null)}
              style={styles.input} accessibilityLabel="Email address" />
          </View>
          <Text style={[styles.label, { marginTop: 16 }]}>Password</Text>
          <View style={[styles.field, focused === 'password' && styles.focused]}>
            <Ionicons name="lock-closed-outline" color={colors.ink400} size={19} />
            <TextInput ref={passwordRef} value={password} onChangeText={setPassword} placeholder="Your password" placeholderTextColor={colors.ink400}
              secureTextEntry={!showPassword} autoCapitalize="none" autoCorrect={false} autoComplete="current-password" returnKeyType="go"
              onFocus={() => setFocused('password')} onBlur={() => setFocused(null)} style={styles.input} accessibilityLabel="Password" onSubmitEditing={() => void submit()} />
            <Pressable accessibilityRole="button" accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              accessibilityState={{ checked: showPassword }} onPress={() => setShowPassword((value) => !value)} style={styles.reveal}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.ink500} />
            </Pressable>
          </View>
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <Button label="Sign in" loading={loading} onPress={() => void submit()} disabled={email.trim().length < 4 || password.length < 6} style={{ marginTop: 22, minHeight: 54 }} />
          <View style={styles.signup}><Small>New to CampusFlow?</Small><Link href={'/register' as any} asChild><Pressable accessibilityRole="link" style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.brand700, fontWeight: '700' }}>Create an account</Text></Pressable></Link></View>
        </Card>

        <View style={{ alignItems: 'center', gap: 6 }}>
          <View style={styles.brand}><Ionicons name="shield-checkmark-outline" color={colors.ink500} size={15} /><Small>Your account. Your campus. Securely connected.</Small></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Demo accounts" accessibilityState={{ expanded: showDemo }} onPress={() => setShowDemo((value) => !value)} style={styles.demoToggle}>
            <Small>Explore with a demo account</Small><Ionicons name={showDemo ? 'chevron-up' : 'chevron-down'} size={15} color={colors.ink500} />
          </Pressable>
        </View>
        {showDemo ? <Card><Eyebrow>Seeded demo accounts</Eyebrow><Small style={{ marginTop: 6 }}>Available when the campus API has demo data. Password: password123</Small><View style={{ marginTop: 14, gap: 10 }}>{DEMO.map((account) => <Button key={account.email} label={`${account.label} · ${account.email}`} variant="secondary" onPress={() => { setEmail(account.email); setPassword('password123'); setError(null); }} />)}</View></Card> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, gap: 22 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  logo: { width: 44, height: 44, backgroundColor: colors.brand600, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  wordmark: { fontSize: 20, letterSpacing: -.6, fontWeight: '800', color: colors.ink900 },
  welcome: { backgroundColor: colors.brand50, borderRadius: 26, overflow: 'hidden' },
  art: { width: '100%', aspectRatio: 2.3 },
  welcomeCopy: { padding: 22, paddingTop: 2 },
  label: { color: colors.ink700, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  field: { minHeight: 54, borderWidth: 1, borderColor: colors.ink200, borderRadius: 15, backgroundColor: colors.ink50, flexDirection: 'row', alignItems: 'center', paddingLeft: 14, paddingRight: 4, gap: 10 },
  focused: { borderColor: colors.brand500, backgroundColor: colors.white },
  input: { flex: 1, minWidth: 0, paddingVertical: 14, fontSize: 16, color: colors.ink900 },
  reveal: { width: 44, minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  error: { ...font.small, color: colors.coral600, marginTop: 12 },
  signup: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  demoToggle: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8 },
});
