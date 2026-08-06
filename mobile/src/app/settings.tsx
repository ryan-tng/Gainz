import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Image,
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

import { AppButton } from '@/components/ui';
import { ACCENTS, Radius, Spacing, type Palette } from '@/constants/theme';
import { pickFromLibrary, takePhoto } from '@/lib/images';
import { storage } from '@/lib/storage';
import { useProfile } from '@/store/profile';
import { useTheme, useThemedStyles, type ThemeMode } from '@/store/theme';

const THEME_MODES: { key: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'light', label: 'Light', icon: 'sunny-outline' },
  { key: 'dark', label: 'Dark', icon: 'moon-outline' },
  { key: 'system', label: 'System', icon: 'phone-portrait-outline' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const { profile, setProfile } = useProfile();
  const { palette, mode, accent, setMode, setAccent } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [name, setName] = useState(profile?.name ?? '');
  const [avatarUri, setAvatarUri] = useState<string | undefined>(profile?.avatarUri);

  const dirty = name !== (profile?.name ?? '') || avatarUri !== profile?.avatarUri;
  const canSave = name.trim().length > 0 && dirty;

  const save = () => {
    if (!canSave) return;
    setProfile({ name: name.trim(), avatarUri });
    router.back();
  };

  const changePhoto = () => {
    const options: {
      text: string;
      style?: 'cancel' | 'destructive';
      onPress?: () => void;
    }[] = [
      {
        text: 'Take photo',
        onPress: async () => {
          const uri = await takePhoto();
          if (uri) setAvatarUri(uri);
        },
      },
      {
        text: 'Choose from library',
        onPress: async () => {
          const uri = await pickFromLibrary();
          if (uri) setAvatarUri(uri);
        },
      },
    ];
    if (avatarUri) {
      options.push({ text: 'Remove photo', style: 'destructive', onPress: () => setAvatarUri(undefined) });
    }
    options.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Profile photo', undefined, options);
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
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={16} style={styles.side}>
          <Ionicons name="chevron-back" size={26} color={palette.fg} />
        </Pressable>
        <Text style={styles.topTitle}>Settings</Text>
        <Pressable onPress={save} hitSlop={16} disabled={!canSave} style={styles.side}>
          <Text style={[styles.save, !canSave && styles.saveDisabled]}>Save</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={8}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {/* Profile */}
          <View style={styles.avatarWrap}>
            <Pressable onPress={changePhoto} style={styles.avatar}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
              ) : (
                <Ionicons name="person" size={44} color={palette.muted} />
              )}
              <View style={styles.avatarEdit}>
                <Ionicons name="camera" size={15} color={palette.onAccent} />
              </View>
            </Pressable>
            <Pressable onPress={changePhoto} hitSlop={8}>
              <Text style={styles.changePhoto}>{avatarUri ? 'Change photo' : 'Add photo'}</Text>
            </Pressable>
          </View>

          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={palette.muted}
          />

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
                  <Ionicons
                    name={m.icon}
                    size={16}
                    color={on ? palette.onAccent : palette.muted}
                  />
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

          {/* About */}
          <Text style={styles.sectionLabel}>About</Text>
          <View style={styles.rowCard}>
            <Text style={styles.rowLabel}>Version</Text>
            <Text style={styles.rowValue}>{version}</Text>
          </View>

          {/* Danger zone */}
          <Text style={styles.sectionLabel}>Data</Text>
          <AppButton
            label="Reset app data"
            icon="trash-outline"
            variant="danger"
            onPress={resetData}
          />
          <Text style={styles.hint}>
            Everything in Gainz is stored only on this device. Resetting clears it all.
          </Text>
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
    borderBottomColor: palette.border,
    borderBottomWidth: 1,
  },
  side: { minWidth: 60 },
  topTitle: { color: palette.fg, fontSize: 17, fontWeight: '700' },
  save: { color: palette.accent, fontSize: 16, fontWeight: '800', textAlign: 'right' },
  saveDisabled: { color: palette.muted },

  content: { padding: Spacing.four, paddingBottom: Spacing.eight },
  avatarWrap: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.four },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: Radius.full,
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: { width: 96, height: 96, borderRadius: Radius.full },
  avatarEdit: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 30,
    height: 30,
    borderRadius: Radius.full,
    backgroundColor: palette.accent,
    borderColor: palette.bg,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changePhoto: { color: palette.accent, fontSize: 14, fontWeight: '700' },

  label: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: '700',
    marginTop: Spacing.two,
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
  hint: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: Spacing.three },
});
