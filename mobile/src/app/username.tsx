import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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
import { confirmAsync, notify } from '@/lib/confirm';
import { isUsernameAllowed } from '@/lib/moderation';
import { USERNAME_RE, claimUsername, getMyProfile, isUsernameAvailable } from '@/lib/social';
import { useAuth } from '@/store/auth';
import { useTheme, useThemedStyles } from '@/store/theme';

type Availability = 'idle' | 'checking' | 'free' | 'taken' | 'unknown';

/**
 * Pick (after sign-up) or change (from Settings) your @username.
 * - Setup mode (default): required — no back button; the only way out is to
 *   claim a handle or sign out.
 * - `?mode=edit`: prefilled with the current handle, back button, Save.
 */
export default function UsernameScreen() {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const editing = mode === 'edit';
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { signOut } = useAuth();

  const [current, setCurrent] = useState<string | null>(null);
  const [handle, setHandle] = useState('');
  const [loading, setLoading] = useState(editing);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<Availability>('idle');

  useEffect(() => {
    if (!editing) return;
    getMyProfile()
      .then((p) => {
        setCurrent(p?.username ?? null);
        setHandle(p?.username ?? '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [editing]);

  const normalized = handle.trim().toLowerCase();
  const valid = USERNAME_RE.test(normalized);
  const unchanged = !!current && normalized === current;
  const allowed = !valid || isUsernameAllowed(normalized);

  // Debounced live "is it taken?" check.
  const seq = useRef(0);
  useEffect(() => {
    setError(null);
    if (!valid || unchanged || !allowed) {
      setAvailability('idle');
      return;
    }
    setAvailability('checking');
    const n = ++seq.current;
    const t = setTimeout(async () => {
      const ok = await isUsernameAvailable(normalized);
      if (n !== seq.current) return;
      setAvailability(ok === null ? 'unknown' : ok ? 'free' : 'taken');
    }, 400);
    return () => clearTimeout(t);
  }, [normalized, valid, unchanged, allowed]);

  const canSave = valid && allowed && !unchanged && !busy && availability !== 'taken' && availability !== 'checking';

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    setError(null);
    try {
      await claimUsername(normalized);
      if (editing) {
        notify('Username updated', `You're now @${normalized}.`);
        router.back();
      } else {
        router.replace('/');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your username.');
      if (e instanceof Error && /taken/i.test(e.message)) setAvailability('taken');
    } finally {
      setBusy(false);
    }
  };

  const signOutFlow = async () => {
    if (
      await confirmAsync({
        title: 'Sign out?',
        message: 'You can pick your username next time you sign in.',
        confirmText: 'Sign out',
      })
    ) {
      await signOut();
      router.replace('/');
    }
  };

  const status = (() => {
    if (!normalized) return null;
    if (!valid) {
      return { color: palette.muted, icon: 'information-circle-outline' as const, text: 'At least 3 characters.' };
    }
    if (!allowed) {
      return { color: palette.danger, icon: 'close-circle' as const, text: 'That username isn’t allowed.' };
    }
    if (unchanged) return { color: palette.muted, icon: 'person-outline' as const, text: 'This is your current username.' };
    switch (availability) {
      case 'checking':
        return { color: palette.muted, icon: null, text: 'Checking…' };
      case 'free':
        return { color: palette.accent, icon: 'checkmark-circle' as const, text: `@${normalized} is available` };
      case 'taken':
        return { color: palette.danger, icon: 'close-circle' as const, text: `@${normalized} is taken` };
      default:
        return null;
    }
  })();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: 'transparent' }]} edges={['top', 'bottom']}>
      <AppBackground />
      <View style={styles.topBar}>
        {editing ? (
          <Pressable onPress={() => router.back()} hitSlop={16} style={styles.side}>
            <Ionicons name="chevron-back" size={26} color={palette.fg} />
          </Pressable>
        ) : (
          <View style={styles.side} />
        )}
        <Text style={styles.topTitle}>{editing ? 'Username' : 'Welcome to Gainz'}</Text>
        <View style={styles.side} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.accent} />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={8}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.logo}>
              <Ionicons name="at-outline" size={30} color={palette.accent} />
            </View>
            <Text style={styles.headline}>{editing ? 'Change your username' : 'Pick a username'}</Text>
            <Text style={styles.sub}>
              {editing
                ? 'Friends will see your new username everywhere. Your friends and streaks stay the same.'
                : 'This is how friends find you and start streaks with you. You can change it later in Settings.'}
            </Text>

            <View style={[styles.handleRow, (availability === 'taken' || !allowed) && { borderColor: palette.danger }]}>
              <Text style={styles.at}>@</Text>
              <TextInput
                style={styles.handleInput}
                value={handle}
                onChangeText={(t) => setHandle(t.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())}
                placeholder="yourname"
                placeholderTextColor={palette.muted}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username-new"
                textContentType="username"
                autoFocus
                maxLength={20}
                returnKeyType="done"
                onSubmitEditing={save}
              />
            </View>
            <View style={styles.statusRow}>
              {status ? (
                <>
                  {status.icon ? (
                    <Ionicons name={status.icon} size={16} color={status.color} />
                  ) : (
                    <ActivityIndicator size="small" color={status.color} />
                  )}
                  <Text style={[styles.statusText, { color: status.color }]}>{status.text}</Text>
                </>
              ) : (
                <Text style={styles.statusText}>3–20 letters, numbers, or underscores.</Text>
              )}
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <AppButton
              label={busy ? 'Saving…' : editing ? 'Save' : 'Continue'}
              icon="checkmark"
              onPress={save}
              disabled={!canSave}
              style={{ marginTop: Spacing.five }}
            />

            {!editing ? (
              <Pressable onPress={signOutFlow} hitSlop={8} style={styles.signOut}>
                <Text style={styles.signOutText}>Sign out</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
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
      borderBottomColor: palette.border,
      borderBottomWidth: 1,
    },
    side: { minWidth: 40 },
    topTitle: { color: palette.fg, fontSize: 17, fontWeight: '700' },
    content: { padding: Spacing.four, paddingBottom: Spacing.eight },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
    headline: { color: palette.fg, fontSize: 24, fontWeight: '800', textAlign: 'center', marginTop: Spacing.three },
    sub: {
      color: palette.muted,
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 20,
      marginTop: Spacing.two,
      marginBottom: Spacing.three,
    },
    handleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: palette.surface,
      borderColor: palette.border,
      borderWidth: 1,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.three,
      marginTop: Spacing.three,
    },
    at: { color: palette.muted, fontSize: 18, fontWeight: '700' },
    handleInput: {
      flex: 1,
      color: palette.fg,
      fontSize: 18,
      fontWeight: '600',
      paddingVertical: Spacing.three,
      paddingLeft: Spacing.one,
    },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.two, minHeight: 20 },
    statusText: { color: palette.muted, fontSize: 13 },
    error: { color: palette.danger, fontSize: 14, marginTop: Spacing.three, lineHeight: 19 },
    signOut: { alignSelf: 'center', marginTop: Spacing.four, padding: Spacing.two },
    signOutText: { color: palette.muted, fontSize: 14, fontWeight: '600' },
  });
