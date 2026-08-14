import { Ionicons } from '@expo/vector-icons';
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

import { AppBackground } from '@/components/AppBackground';
import { LineChart } from '@/components/LineChart';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { formatDate } from '@/lib/format';
import { pickFromLibrary, takePhoto, usableImageUri } from '@/lib/images';
import { useProfile } from '@/store/profile';
import { useTheme, useThemedStyles } from '@/store/theme';

const numOrNull = (t: string): number | null => {
  const cleaned = t.replace(/[^0-9.]/g, '');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

export default function ProfileScreen() {
  const router = useRouter();
  const { profile, setProfile, bodyWeights, addBodyWeight, deleteBodyWeight } = useProfile();
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [name, setName] = useState(profile?.name ?? '');
  const [avatarUri, setAvatarUri] = useState<string | undefined>(profile?.avatarUri);
  const [weightInput, setWeightInput] = useState('');

  const canSave = name.trim().length > 0;

  const logWeight = () => {
    const w = numOrNull(weightInput);
    if (w === null || w <= 0) return;
    addBodyWeight(w);
    setWeightInput('');
  };

  // Chronological (oldest → newest) for the trend line.
  const chrono = [...bodyWeights].reverse();
  const values = chrono.map((e) => e.weightLb);
  const latest = bodyWeights[0]?.weightLb ?? null;
  const high = values.length ? Math.max(...values) : null;
  const low = values.length ? Math.min(...values) : null;

  const save = () => {
    if (!canSave) return;
    setProfile({ name: name.trim(), avatarUri });
    router.back();
  };

  const changePhoto = () => {
    // Web has no native action sheet — open the file picker directly.
    if (Platform.OS === 'web') {
      void (async () => {
        const uri = await pickFromLibrary();
        if (uri) setAvatarUri(uri);
      })();
      return;
    }
    const options: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [
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

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: 'transparent' }]} edges={['top', 'bottom']}>
      <AppBackground />
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={16} style={styles.side}>
          <Ionicons name="chevron-back" size={26} color={palette.fg} />
        </Pressable>
        <Text style={styles.topTitle}>Profile</Text>
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
          <View style={styles.avatarWrap}>
            <Pressable onPress={changePhoto} style={styles.avatar}>
              {usableImageUri(avatarUri) ? (
                <Image source={{ uri: usableImageUri(avatarUri) }} style={styles.avatarImg} />
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

          {/* Body weight */}
          <Text style={styles.sectionLabel}>Body weight</Text>
          <View style={styles.bwAddRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={weightInput}
              onChangeText={setWeightInput}
              placeholder="Today's weight (lb)"
              placeholderTextColor={palette.muted}
              keyboardType="numeric"
              returnKeyType="done"
              onSubmitEditing={logWeight}
            />
            <Pressable
              onPress={logWeight}
              disabled={numOrNull(weightInput) === null}
              style={[styles.logBtn, numOrNull(weightInput) === null && { opacity: 0.5 }]}>
              <Text style={styles.logBtnText}>Log</Text>
            </Pressable>
          </View>

          {values.length === 0 ? (
            <Text style={styles.bwEmpty}>Log your weight to see your trend over time.</Text>
          ) : (
            <>
              <View style={styles.bwStats}>
                <View style={styles.bwStat}>
                  <Text style={[styles.bwStatValue, { color: palette.accent }]}>{latest} lb</Text>
                  <Text style={styles.bwStatLabel}>Current</Text>
                </View>
                <View style={styles.bwStat}>
                  <Text style={styles.bwStatValue}>{high} lb</Text>
                  <Text style={styles.bwStatLabel}>High</Text>
                </View>
                <View style={styles.bwStat}>
                  <Text style={styles.bwStatValue}>{low} lb</Text>
                  <Text style={styles.bwStatLabel}>Low</Text>
                </View>
              </View>

              {values.length > 1 ? (
                <View style={styles.chartCard}>
                  <LineChart
                    values={values}
                    labels={[
                      formatDate(chrono[0].loggedAt),
                      formatDate(chrono[chrono.length - 1].loggedAt),
                    ]}
                  />
                </View>
              ) : null}

              {bodyWeights.slice(0, 6).map((e) => (
                <View key={e.id} style={styles.bwRow}>
                  <Text style={styles.bwRowWeight}>{e.weightLb} lb</Text>
                  <Text style={styles.bwRowDate}>{formatDate(e.loggedAt)}</Text>
                  <Pressable onPress={() => deleteBodyWeight(e.id)} hitSlop={8}>
                    <Ionicons name="close-circle" size={20} color={palette.muted} />
                  </Pressable>
                </View>
              ))}
            </>
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
    bwAddRow: { flexDirection: 'row', gap: Spacing.two, alignItems: 'stretch' },
    logBtn: {
      backgroundColor: palette.accent,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.five,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logBtnText: { color: palette.onAccent, fontSize: 15, fontWeight: '800' },
    bwEmpty: { color: palette.muted, fontSize: 14, marginTop: Spacing.three, lineHeight: 20 },
    bwStats: { flexDirection: 'row', gap: Spacing.three, marginTop: Spacing.four },
    bwStat: {
      flex: 1,
      backgroundColor: palette.surface,
      borderColor: palette.border,
      borderWidth: 1,
      borderRadius: Radius.md,
      padding: Spacing.three,
      alignItems: 'center',
      gap: 2,
    },
    bwStatValue: { color: palette.fg, fontSize: 18, fontWeight: '800' },
    bwStatLabel: { color: palette.muted, fontSize: 12 },
    chartCard: {
      backgroundColor: palette.surface,
      borderColor: palette.border,
      borderWidth: 1,
      borderRadius: Radius.lg,
      padding: Spacing.four,
      marginTop: Spacing.three,
    },
    bwRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.three,
      paddingVertical: Spacing.three,
      borderTopColor: palette.border,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    bwRowWeight: { color: palette.fg, fontSize: 15, fontWeight: '700', flex: 1 },
    bwRowDate: { color: palette.muted, fontSize: 13 },
  });
