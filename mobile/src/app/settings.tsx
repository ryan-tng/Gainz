import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBackground } from '@/components/AppBackground';
import { AppButton } from '@/components/ui';
import { ACCENTS, GRADIENTS, Radius, Spacing, type Palette } from '@/constants/theme';
import { pickFromLibrary } from '@/lib/images';
import { storage } from '@/lib/storage';
import { backupToCloud, restoreFromCloud } from '@/lib/sync';
import { useAuth } from '@/store/auth';
import { useNutrition } from '@/store/nutrition';
import { useRestTimer } from '@/store/restTimer';
import { useTheme, useThemedStyles, type ThemeMode } from '@/store/theme';

const THEME_MODES: { key: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'light', label: 'Light', icon: 'sunny-outline' },
  { key: 'dark', label: 'Dark', icon: 'moon-outline' },
  { key: 'system', label: 'System', icon: 'phone-portrait-outline' },
];

const REST_PRESETS: { s: number; label: string }[] = [
  { s: 30, label: '30s' },
  { s: 60, label: '1m' },
  { s: 90, label: '1m 30s' },
  { s: 120, label: '2m' },
  { s: 180, label: '3m' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const {
    palette,
    mode,
    accent,
    background,
    savedBackgrounds,
    setMode,
    setAccent,
    setBackground,
    addSavedBackground,
    removeSavedBackground,
  } = useTheme();
  const { coachName, setCoachName } = useNutrition();
  const { defaultSeconds, setDefaultSeconds } = useRestTimer();
  const { configured, user, signOut } = useAuth();
  const styles = useThemedStyles(makeStyles);
  const [coachNameDraft, setCoachNameDraft] = useState(coachName);
  const [syncing, setSyncing] = useState(false);

  const backup = async () => {
    setSyncing(true);
    try {
      await backupToCloud();
      Alert.alert('Backed up', 'Your data is safely saved to the cloud.');
    } catch (e) {
      Alert.alert('Backup failed', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  const restore = () => {
    Alert.alert(
      'Restore from cloud?',
      'This replaces the data on this device with your cloud backup. Fully reload the app afterward to see it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          onPress: async () => {
            setSyncing(true);
            try {
              const ok = await restoreFromCloud();
              Alert.alert(
                ok ? 'Restored' : 'No backup',
                ok
                  ? 'Fully reload the app (shake → Reload, or restart it) to see your restored data.'
                  : 'No cloud backup was found for this account yet.',
              );
            } catch (e) {
              Alert.alert('Restore failed', e instanceof Error ? e.message : 'Please try again.');
            } finally {
              setSyncing(false);
            }
          },
        },
      ],
    );
  };

  const pickBackgroundPhoto = async () => {
    const uri = await pickFromLibrary();
    if (!uri) return;
    addSavedBackground(uri);
    setBackground({ type: 'image', uri, dim: 0.5 });
  };

  const confirmDeleteBackground = (uri: string) => {
    Alert.alert('Delete background?', 'Remove this photo from your saved backgrounds?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removeSavedBackground(uri) },
    ]);
  };

  const resetData = () => {
    Alert.alert(
      'Reset app data?',
      'This permanently deletes your workouts, templates, records, food log, goal, and profile on this device. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: async () => {
            await storage.clearAll();
            Alert.alert(
              'Data cleared',
              'Fully reload the app (shake → Reload, or restart it) to start fresh.',
            );
          },
        },
      ],
    );
  };

  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: 'transparent' }]} edges={['top', 'bottom']}>
      <AppBackground />
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={16} style={styles.side}>
          <Ionicons name="chevron-back" size={26} color={palette.fg} />
        </Pressable>
        <Text style={styles.topTitle}>Settings</Text>
        <View style={styles.side} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Account */}
        <Text style={styles.sectionLabel}>Account</Text>
        {!configured ? (
          <Text style={styles.hint}>Cloud accounts aren&apos;t configured in this build yet.</Text>
        ) : user ? (
          <>
            <View style={styles.rowCard}>
              <Text style={styles.rowLabel}>Signed in</Text>
              <Text style={styles.rowValue} numberOfLines={1}>
                {user.email}
              </Text>
            </View>
            <AppButton
              label={syncing ? 'Working…' : 'Back up now'}
              icon="cloud-upload-outline"
              onPress={backup}
              disabled={syncing}
              style={{ marginTop: Spacing.two }}
            />
            <AppButton
              label="Restore from cloud"
              icon="cloud-download-outline"
              variant="secondary"
              onPress={restore}
              disabled={syncing}
              style={{ marginTop: Spacing.two }}
            />
            <AppButton
              label="Sign out"
              icon="log-out-outline"
              variant="ghost"
              onPress={signOut}
              style={{ marginTop: Spacing.two }}
            />
          </>
        ) : (
          <>
            <AppButton
              label="Sign in / Create account"
              icon="cloud-outline"
              onPress={() => router.push('/auth')}
            />
            <Text style={styles.hint}>Back up your data and sync it to a new phone.</Text>
          </>
        )}

        {/* Appearance */}
        <Text style={styles.sectionLabel}>Appearance</Text>
        <View style={styles.segment}>
          {THEME_MODES.map((m) => {
            const on = mode === m.key;
            return (
              <Pressable
                key={m.key}
                onPress={() => setMode(m.key)}
                style={[styles.segmentBtn, on && styles.segmentBtnOn]}>
                <Ionicons name={m.icon} size={16} color={on ? palette.onAccent : palette.muted} />
                <Text style={[styles.segmentText, on && styles.segmentTextOn]}>{m.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.subLabel}>Accent color</Text>
        <View style={styles.accentRow}>
          {ACCENTS.map((c) => (
            <Pressable
              key={c}
              onPress={() => setAccent(c)}
              style={[styles.accentDot, { backgroundColor: c }, accent === c && styles.accentDotOn]}>
              {accent === c ? <Ionicons name="checkmark" size={16} color={palette.onAccent} /> : null}
            </Pressable>
          ))}
        </View>

        <Text style={styles.subLabel}>Home background</Text>
        <View style={styles.bgRow}>
          <Pressable
            onPress={() => setBackground({ type: 'none' })}
            style={[styles.bgSwatch, styles.bgNone, background.type === 'none' && styles.bgSwatchOn]}>
            {background.type === 'none' ? (
              <Ionicons name="checkmark" size={18} color={palette.fg} />
            ) : (
              <Text style={styles.bgNoneText}>None</Text>
            )}
          </Pressable>

          {GRADIENTS.map((g) => {
            const on = background.type === 'gradient' && background.id === g.id;
            return (
              <Pressable
                key={g.id}
                onPress={() => setBackground({ type: 'gradient', id: g.id })}
                style={[styles.bgSwatch, on && styles.bgSwatchOn]}>
                <LinearGradient
                  colors={g.colors(palette) as [string, string, ...string[]]}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
                {on ? <Ionicons name="checkmark" size={18} color={palette.fg} /> : null}
              </Pressable>
            );
          })}

          {/* Saved photo backgrounds */}
          {savedBackgrounds.map((uri) => {
            const on = background.type === 'image' && background.uri === uri;
            return (
              <View key={uri} style={styles.bgSwatchWrap}>
                <Pressable
                  onPress={() =>
                    setBackground({ type: 'image', uri, dim: on ? background.dim ?? 0.5 : 0.5 })
                  }
                  style={[styles.bgSwatch, on && styles.bgSwatchOn]}>
                  <Image source={{ uri }} style={StyleSheet.absoluteFill} />
                  {on ? (
                    <View style={styles.bgCheck}>
                      <Ionicons name="checkmark" size={16} color={palette.onAccent} />
                    </View>
                  ) : null}
                </Pressable>
                <Pressable
                  hitSlop={8}
                  onPress={() => confirmDeleteBackground(uri)}
                  style={styles.bgDelete}>
                  <Ionicons name="close" size={12} color={palette.onAccent} />
                </Pressable>
              </View>
            );
          })}

          {/* Add a new photo */}
          <Pressable onPress={pickBackgroundPhoto} style={[styles.bgSwatch, styles.bgAdd]}>
            <Ionicons name="add" size={24} color={palette.muted} />
          </Pressable>
        </View>

        {/* Background dim — only relevant for a custom photo */}
        {background.type === 'image' ? (
          <View style={styles.dimBlock}>
            <View style={styles.dimHead}>
              <Text style={styles.subLabel}>Background dim</Text>
              <Text style={styles.dimValue}>{Math.round((background.dim ?? 0) * 100)}%</Text>
            </View>
            <Slider
              minimumValue={0}
              maximumValue={0.9}
              step={0.05}
              value={background.dim ?? 0}
              onValueChange={(v) => setBackground({ type: 'image', uri: background.uri, dim: v })}
              minimumTrackTintColor={palette.accent}
              maximumTrackTintColor={palette.border}
              thumbTintColor={palette.accent}
            />
            <Text style={styles.hint}>Darken the background so text stays readable. 0% shows it raw.</Text>
          </View>
        ) : null}

        {/* Workout */}
        <Text style={styles.sectionLabel}>Rest timer</Text>
        <View style={styles.restRow}>
          {REST_PRESETS.map((p) => {
            const on = defaultSeconds === p.s;
            return (
              <Pressable
                key={p.s}
                onPress={() => setDefaultSeconds(p.s)}
                style={[styles.restPill, on && styles.restPillOn]}>
                <Text style={[styles.restPillText, on && styles.restPillTextOn]}>{p.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.hint}>Auto-starts after you complete a set. Tap −15/+15 or Skip on the timer.</Text>

        {/* AI Coach */}
        <Text style={styles.sectionLabel}>AI Coach</Text>
        <TextInput
          style={styles.input}
          value={coachNameDraft}
          onChangeText={setCoachNameDraft}
          onEndEditing={() => setCoachName(coachNameDraft)}
          onBlur={() => setCoachName(coachNameDraft)}
          placeholder="AI Coach"
          placeholderTextColor={palette.muted}
          returnKeyType="done"
        />
        <Text style={styles.hint}>Rename your nutrition coach (e.g. &quot;Coach Mike&quot;).</Text>

        {/* About */}
        <Text style={styles.sectionLabel}>About</Text>
        <View style={styles.rowCard}>
          <Text style={styles.rowLabel}>Version</Text>
          <Text style={styles.rowValue}>{version}</Text>
        </View>

        {/* Danger zone */}
        <Text style={styles.sectionLabel}>Data</Text>
        <AppButton label="Reset app data" icon="trash-outline" variant="danger" onPress={resetData} />
        <Text style={styles.hint}>
          Everything in Gainz is stored only on this device. Resetting clears it all.
        </Text>
      </ScrollView>
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

    sectionLabel: {
      color: palette.muted,
      fontSize: 13,
      fontWeight: '700',
      marginTop: Spacing.five,
      marginBottom: Spacing.two,
    },
    subLabel: { color: palette.muted, fontSize: 12, marginTop: Spacing.three, marginBottom: Spacing.two },
    segment: {
      flexDirection: 'row',
      backgroundColor: palette.surface,
      borderColor: palette.border,
      borderWidth: 1,
      borderRadius: Radius.md,
      padding: 3,
      gap: 3,
    },
    segmentBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.one + 2,
      paddingVertical: Spacing.two + 2,
      borderRadius: Radius.sm,
    },
    segmentBtnOn: { backgroundColor: palette.accent },
    segmentText: { color: palette.muted, fontSize: 14, fontWeight: '700' },
    segmentTextOn: { color: palette.onAccent },
    accentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
    accentDot: {
      width: 40,
      height: 40,
      borderRadius: Radius.full,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: 'transparent',
    },
    accentDotOn: { borderColor: palette.fg },
    bgRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
    bgSwatch: {
      width: 56,
      height: 56,
      borderRadius: Radius.md,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: palette.border,
    },
    bgSwatchOn: { borderColor: palette.fg },
    bgNone: { backgroundColor: palette.surface },
    bgNoneText: { color: palette.muted, fontSize: 12, fontWeight: '700' },
    bgAdd: { backgroundColor: palette.surface, borderStyle: 'dashed' },
    bgSwatchWrap: { width: 56, height: 56 },
    bgCheck: {
      width: 24,
      height: 24,
      borderRadius: Radius.full,
      backgroundColor: palette.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bgDelete: {
      position: 'absolute',
      top: -6,
      right: -6,
      width: 22,
      height: 22,
      borderRadius: Radius.full,
      backgroundColor: palette.danger,
      borderColor: palette.bg,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dimBlock: { marginTop: Spacing.one },
    dimHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    dimValue: { color: palette.fg, fontSize: 13, fontWeight: '700', marginTop: Spacing.three },

    rowCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: palette.surface,
      borderColor: palette.border,
      borderWidth: 1,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.four,
      paddingVertical: Spacing.three,
    },
    rowLabel: { color: palette.fg, fontSize: 15 },
    rowValue: { color: palette.muted, fontSize: 15 },
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
    restRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
    restPill: {
      paddingHorizontal: Spacing.four,
      paddingVertical: Spacing.two + 2,
      borderRadius: Radius.full,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.surface,
    },
    restPillOn: { backgroundColor: palette.accent, borderColor: palette.accent },
    restPillText: { color: palette.muted, fontSize: 14, fontWeight: '700' },
    restPillTextOn: { color: palette.onAccent },
    hint: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: Spacing.three },
  });
