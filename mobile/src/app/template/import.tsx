import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
import { fetchSharedTemplate } from '@/lib/share';
import { useTheme, useThemedStyles } from '@/store/theme';
import { useWorkouts } from '@/store/workouts';

export default function ImportTemplateScreen() {
  const router = useRouter();
  const { addTemplate } = useWorkouts();
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canImport = code.trim().length >= 4 && !busy;

  const onImport = async () => {
    if (!canImport) return;
    setBusy(true);
    setError(null);
    try {
      const shared = await fetchSharedTemplate(code);
      if (!shared) {
        setError('No workout found for that code. Double-check it and try again.');
        return;
      }
      addTemplate({
        name: shared.name,
        icon: shared.icon,
        color: shared.color,
        exercises: shared.exercises,
      });
      notify('Workout added', `"${shared.name}" is now in your workouts.`);
      router.back();
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
        <Pressable onPress={() => router.back()} hitSlop={16} style={styles.side}>
          <Ionicons name="close" size={26} color={palette.fg} />
        </Pressable>
        <Text style={styles.topTitle}>Import workout</Text>
        <View style={styles.side} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={8}>
        <View style={styles.content}>
          <View style={styles.icon}>
            <Ionicons name="download-outline" size={30} color={palette.accent} />
          </View>
          <Text style={styles.headline}>Got a workout code?</Text>
          <Text style={styles.sub}>
            Enter the code a friend shared to add their workout to your list.
          </Text>

          <TextInput
            style={styles.input}
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            placeholder="e.g. K7P2QW"
            placeholderTextColor={palette.muted}
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus
            maxLength={8}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <AppButton
            label={busy ? 'Importing…' : 'Import workout'}
            icon="download"
            onPress={onImport}
            disabled={!canImport}
            style={{ marginTop: Spacing.five }}
          />
          {busy ? <ActivityIndicator color={palette.accent} style={{ marginTop: Spacing.four }} /> : null}
        </View>
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
    content: { padding: Spacing.four, alignItems: 'center' },
    icon: {
      width: 60,
      height: 60,
      borderRadius: Radius.full,
      backgroundColor: palette.surface,
      borderColor: palette.border,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: Spacing.four,
    },
    headline: { color: palette.fg, fontSize: 22, fontWeight: '800', marginTop: Spacing.three },
    sub: {
      color: palette.muted,
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 20,
      marginTop: Spacing.two,
      marginBottom: Spacing.four,
      maxWidth: 300,
    },
    input: {
      alignSelf: 'stretch',
      color: palette.fg,
      fontSize: 24,
      fontWeight: '800',
      letterSpacing: 4,
      textAlign: 'center',
      backgroundColor: palette.surface,
      borderColor: palette.border,
      borderWidth: 1,
      borderRadius: Radius.md,
      paddingVertical: Spacing.four,
    },
    error: { color: palette.danger, fontSize: 14, marginTop: Spacing.three, textAlign: 'center' },
  });
