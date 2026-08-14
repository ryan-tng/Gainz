import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBackground } from '@/components/AppBackground';
import { AppButton } from '@/components/ui';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { notify } from '@/lib/confirm';
import { useAuth } from '@/store/auth';
import { useTheme, useThemedStyles } from '@/store/theme';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AuthScreen() {
  const router = useRouter();
  const { signIn, signUp, user } = useAuth();
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = EMAIL_RE.test(email.trim()) && password.length >= 6;
  // This screen is only reached as the required sign-in gate (you can't open it
  // while signed in), so there's nothing to dismiss to.
  const canDismiss = !!user;
  const done = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === 'signin') {
        await signIn(email, password);
        done();
      } else {
        const started = await signUp(email, password);
        if (started) {
          done();
        } else {
          setMode('signin');
          notify(
            'Confirm your email',
            'We sent you a confirmation link. Verify your email, then sign in.',
          );
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: 'transparent' }]} edges={['top', 'bottom']}>
      <AppBackground />
      <View style={styles.topBar}>
        {canDismiss ? (
          <Pressable onPress={() => router.back()} hitSlop={16} style={styles.side}>
            <Ionicons name="close" size={26} color={palette.fg} />
          </Pressable>
        ) : (
          <View style={styles.side} />
        )}
        <Text style={styles.topTitle}>{mode === 'signin' ? 'Sign in' : 'Create account'}</Text>
        <View style={styles.side} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={8}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.logo}>
            <Ionicons name="cloud-outline" size={30} color={palette.accent} />
          </View>
          <Text style={styles.headline}>
            {mode === 'signin' ? 'Welcome back' : 'Back up your progress'}
          </Text>
          <Text style={styles.sub}>
            An account backs up your workouts, records, and nutrition to the cloud and syncs them to
            a new phone.
          </Text>

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={palette.muted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="At least 6 characters"
            placeholderTextColor={palette.muted}
            secureTextEntry
            autoCapitalize="none"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <AppButton
            label={busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
            icon="arrow-forward"
            onPress={submit}
            disabled={!valid || busy}
            style={{ marginTop: Spacing.five }}
          />

          <Pressable
            onPress={() => {
              setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
              setError(null);
            }}
            hitSlop={8}
            style={styles.toggle}>
            <Text style={styles.toggleText}>
              {mode === 'signin'
                ? "Don't have an account? Create one"
                : 'Already have an account? Sign in'}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.bg },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.four,
      paddingVertical: Spacing.three,
    },
    side: { minWidth: 40 },
    topTitle: { color: palette.fg, fontSize: 17, fontWeight: '700' },
    content: { padding: Spacing.four, paddingBottom: Spacing.eight },
    logo: {
      width: 60,
      height: 60,
      borderRadius: Radius.full,
      backgroundColor: palette.surface,
      borderColor: palette.border,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      marginTop: Spacing.four,
    },
    headline: {
      color: palette.fg,
      fontSize: 24,
      fontWeight: '800',
      textAlign: 'center',
      marginTop: Spacing.three,
    },
    sub: {
      color: palette.muted,
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 20,
      marginTop: Spacing.two,
      marginBottom: Spacing.three,
    },
    label: {
      color: palette.muted,
      fontSize: 13,
      fontWeight: '700',
      marginTop: Spacing.four,
      marginBottom: Spacing.two,
    },
    input: {
      color: palette.fg,
      fontSize: 16,
      backgroundColor: palette.surface,
      borderColor: palette.border,
      borderWidth: 1,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.three,
    },
    error: { color: palette.danger, fontSize: 14, marginTop: Spacing.three, lineHeight: 19 },
    toggle: { alignItems: 'center', marginTop: Spacing.four },
    toggleText: { color: palette.accent, fontSize: 14, fontWeight: '700' },
  });
