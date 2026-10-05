import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { ApiError, api } from '../api';
import { useSession } from '../session';
import { colours, styles } from '../theme';

interface DemoAccount {
  role: 'STUDENT' | 'STAFF' | 'ADMIN';
  email: string;
  name: string;
}

/**
 * Sign-in.
 *
 * The student account is offered as a one-tap button rather than signed in silently:
 * on a phone the person chooses which account the device remembers, because the token
 * is written to the keychain and outlives the launch.
 */
export function LoginScreen() {
  const { signIn, expired } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accounts, setAccounts] = useState<DemoAccount[]>([]);
  const [demoPassword, setDemoPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api<{ password: string; accounts: DemoAccount[] }>('/auth/demo-accounts', { auth: false })
      .then((payload) => {
        setAccounts(payload.accounts.filter((account) => account.role === 'STUDENT'));
        setDemoPassword(payload.password);
      })
      .catch(() => setAccounts([]));
  }, []);

  async function enter(targetEmail: string, targetPassword: string) {
    setBusy(true);
    setError(null);
    try {
      await signIn(targetEmail.trim(), targetPassword);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Sign in failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: 70 }]}>
        <Text style={styles.eyebrow}>CampusFlow · Yaoundé</Text>
        <Text style={styles.title}>Sign in to your campus</Text>
        <Text style={styles.subtitle}>
          Scan the QR anchors on campus walls, follow indoor routes and keep your appointments in your pocket.
        </Text>
        <Text style={styles.muted}>
          Application étudiante. La scolarité et l’administration travaillent sur CampusFlow web.
        </Text>

        {expired && !error ? (
          <Text style={[styles.notice, styles.noticeError]}>
            Votre session a pris fin — reconnectez-vous pour reprendre où vous en étiez.
          </Text>
        ) : null}

        {error ? <Text style={[styles.notice, styles.noticeError]}>{error}</Text> : null}

        {accounts.map((account) => (
          <Pressable
            key={account.email}
            accessibilityRole="button"
            style={[styles.button, busy && { opacity: 0.6 }]}
            disabled={busy}
            onPress={() => void enter(account.email, demoPassword)}
          >
            <Text style={styles.buttonText}>Continue as {account.name.split(' ')[0]} (student)</Text>
          </Pressable>
        ))}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Your account</Text>
          <View>
            <Text style={styles.label}>Email address</Text>
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              placeholder="etudiant@iaicameroun.cm"
              placeholderTextColor={colours.ink500}
            />
          </View>
          <View>
            <Text style={styles.label}>Password</Text>
            <TextInput style={styles.input} secureTextEntry value={password} onChangeText={setPassword} />
          </View>
          <Pressable
            accessibilityRole="button"
            style={[styles.button, styles.buttonGhost, busy && { opacity: 0.6 }]}
            disabled={busy}
            onPress={() => void enter(email, password)}
          >
            {busy ? <ActivityIndicator color={colours.brand} /> : <Text style={styles.buttonGhostText}>Sign in</Text>}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
