import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
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

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { at, rt } = useLocalSearchParams<{ at?: string; rt?: string }>();
  const { completePasswordReset } = useAuth();
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasTokens = !!at && !!rt;
  const valid = password.length >= 6 && password === confirm && hasTokens;

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await completePasswordReset(at as string, rt as string, password);
      notify('Password updated', 'Sign in with your new password.');
      router.replace('/auth');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update your password. The link may have expired.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: 'transparent' }]} edges={['top', 'bottom']}>
      <AppBackground />
      <View style={styles.topBar}>
        <Pressable onPress={() => router.replace('/auth')} hitSlop={16} style={styles.side}>
          <Ionicons name="close" size={26} color={palette.fg} />
        </Pressable>
        <Text style={styles.topTitle}>Reset password</Text>
        <View style={styles.side} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={8}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.logo}>
            <Ionicons name="lock-closed-outline" size={30} color={palette.accent} />
          </View>
          <Text style={styles.headline}>Set a new password</Text>
          <Text style={styles.sub}>
            {hasTokens
              ? 'Choose a new password for your account.'
              : 'This screen opens from the reset link in your email. Request a new link from the sign-in screen.'}
          </Text>

          {hasTokens ? (
            <>
              <Text style={styles.label}>New password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="At least 6 characters"
                placeholderTextColor={palette.muted}
                secureTextEntry
                autoCapitalize="none"
              />

              <Text style={styles.label}>Confirm password</Text>
              <TextInput
                style={styles.input}
                value={confirm}
                onChangeText={setConfirm}
                placeholder="Re-enter password"
                placeholderTextColor={palette.muted}
                secureTextEntry
                autoCapitalize="none"
              />

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <AppButton
                label={busy ? 'Updating…' : 'Update password'}
                icon="checkmark"
                onPress={submit}
                disabled={!valid || busy}
                style={{ marginTop: Spacing.five }}
              />
            </>
          ) : (
            <AppButton
              label="Back to sign in"
              icon="arrow-back"
              onPress={() => router.replace('/auth')}
              style={{ marginTop: Spacing.five }}
            />
          )}
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
  });
