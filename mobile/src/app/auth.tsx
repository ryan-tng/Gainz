import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
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
import { API_BASE_URL } from '@/lib/config';
import { notify } from '@/lib/confirm';
import { useAuth } from '@/store/auth';
import { useTheme, useThemedStyles } from '@/store/theme';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AuthScreen() {
  const router = useRouter();
  const { signIn, signUp, resetPassword, user } = useAuth();
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);

  const valid =
    EMAIL_RE.test(email.trim()) && password.length >= 6 && (mode === 'signin' || agreed);
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
        // Don't navigate manually — signing in sets `user` and remounts the app
        // tree, which lands on home on its own. Show an overlay until it does so
        // the form can't be re-tapped mid-transition.
        setCompleting(true);
      } else {
        const started = await signUp(email, password);
        if (started) {
          setCompleting(true);
        } else {
          setMode('signin');
          notify(
            'Confirm your email',
            'We sent you a confirmation link. Verify your email, then sign in.',
          );
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong.';
      setError(msg);
      // If they tried to create an account that already exists, drop them on the
      // sign-in form with their email still filled in.
      if (/already exists/i.test(msg)) setMode('signin');
    } finally {
      setBusy(false);
    }
  };

  const onForgot = async () => {
    if (!EMAIL_RE.test(email.trim())) {
      setError('Enter your email above first, then tap Forgot password.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await resetPassword(email);
      notify('Check your email', `We sent a password reset link to ${email.trim()}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send a reset email.');
    } finally {
      setBusy(false);
    }
  };

  // Signed in: go home. Signing in remounts the app tree (to load the account's
  // cloud data), which re-creates this screen with `completing` reset, so this
  // screen must leave on its own whenever a user exists. `user` is only set
  // after the cloud pull finishes, so home opens with the account's data.
  if (user) return <Redirect href="/" />;

  if (completing) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: 'transparent' }]} edges={['top', 'bottom']}>
        <AppBackground />
        <View style={styles.completing}>
          <ActivityIndicator color={palette.accent} size="large" />
          <Text style={styles.completingText}>Signing you in…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: 'transparent' }]} edges={['top', 'bottom']}>
      <AppBackground />
      <View style={styles.topBar}>
        {canDismiss ? (
          <Pressable onPress={done} hitSlop={16} style={styles.side}>
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

          {mode === 'signup' ? (
            <View style={styles.agreeRow}>
              <Pressable
                onPress={() => setAgreed((a) => !a)}
                hitSlop={8}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: agreed }}
                accessibilityLabel="I agree to the Terms of Use and Privacy Policy"
                style={[styles.checkbox, agreed && styles.checkboxOn]}>
                {agreed ? <Ionicons name="checkmark" size={16} color={palette.onAccent} /> : null}
              </Pressable>
              <Text style={styles.agreeText}>
                I agree to the{' '}
                <Text style={styles.agreeLink} onPress={() => Linking.openURL(`${API_BASE_URL}/terms`)}>
                  Terms of Use
                </Text>{' '}
                and{' '}
                <Text style={styles.agreeLink} onPress={() => Linking.openURL(`${API_BASE_URL}/privacy`)}>
                  Privacy Policy
                </Text>
                . There&apos;s no tolerance for objectionable content or abusive users.
              </Text>
            </View>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <AppButton
            label={busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
            icon="arrow-forward"
            onPress={submit}
            disabled={!valid || busy}
            style={{ marginTop: Spacing.five }}
          />

          {mode === 'signin' ? (
            <Pressable onPress={onForgot} hitSlop={8} disabled={busy} style={styles.forgot}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </Pressable>
          ) : null}

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
    completing: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
    completingText: { color: palette.muted, fontSize: 15, fontWeight: '600' },
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
    agreeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three, marginTop: Spacing.four },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: palette.border,
      backgroundColor: palette.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 1,
    },
    checkboxOn: { backgroundColor: palette.accent, borderColor: palette.accent },
    agreeText: { flex: 1, color: palette.muted, fontSize: 13, lineHeight: 19 },
    agreeLink: { color: palette.accent, fontWeight: '700' },
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
    forgot: { alignItems: 'center', marginTop: Spacing.four },
    forgotText: { color: palette.muted, fontSize: 14, fontWeight: '600' },
    toggle: { alignItems: 'center', marginTop: Spacing.three },
    toggleText: { color: palette.accent, fontSize: 14, fontWeight: '700' },
  });
