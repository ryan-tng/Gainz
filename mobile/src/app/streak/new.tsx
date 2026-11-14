import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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
import { notify } from '@/lib/confirm';
import { createStreak, listFriends, type OnMiss, type Profile } from '@/lib/social';
import { useTheme, useThemedStyles } from '@/store/theme';

const PRESETS = [2, 3, 4] as const;

export default function NewStreakScreen() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState<Profile[]>([]);
  const [friendId, setFriendId] = useState<string | null>(null);

  const [name, setName] = useState('Workout Streak');
  const [preset, setPreset] = useState<number | 'custom'>(3);
  const [customTarget, setCustomTarget] = useState('3');
  const [sameTarget, setSameTarget] = useState(true);
  const [friendTargetInput, setFriendTargetInput] = useState('3');
  const [onMiss, setOnMiss] = useState<OnMiss>('reset');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const f = await listFriends();
        setFriends(f);
        if (f.length === 1) setFriendId(f[0].user_id);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const myTarget = preset === 'custom' ? parseInt(customTarget, 10) || 0 : preset;
  const friendTarget = sameTarget ? myTarget : parseInt(friendTargetInput, 10) || 0;
  const valid =
    name.trim().length > 0 &&
    !!friendId &&
    myTarget >= 1 &&
    myTarget <= 14 &&
    friendTarget >= 1 &&
    friendTarget <= 14;

  const submit = async () => {
    if (!valid || !friendId || busy) return;
    setBusy(true);
    try {
      await createStreak(name, friendId, myTarget, friendTarget, onMiss);
      const friend = friends.find((f) => f.user_id === friendId);
      notify('Invite sent', `@${friend?.username ?? 'your friend'} needs to accept before the streak starts.`);
      router.back();
    } catch (e) {
      notify('Could not create streak', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: 'transparent' }]} edges={['top', 'bottom']}>
      <AppBackground />
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={16} style={styles.side}>
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
        <Text style={styles.topTitle}>New streak</Text>
        <View style={styles.side} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.accent} />
        </View>
      ) : friends.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="people-outline" size={32} color={palette.muted} />
          <Text style={styles.empty}>Add a friend first, then start a streak together.</Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={8}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Streak name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Workout Streak"
              placeholderTextColor={palette.muted}
              maxLength={60}
            />

            <Text style={styles.label}>Streak with</Text>
            <View style={styles.friendWrap}>
              {friends.map((f) => {
                const on = friendId === f.user_id;
                return (
                  <Pressable
                    key={f.user_id}
                    onPress={() => setFriendId(f.user_id)}
                    style={[styles.friendPill, on && styles.pillOn]}>
                    <Text style={[styles.friendPillText, on && styles.pillTextOn]}>@{f.username}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>Workouts per week</Text>
            <View style={styles.row}>
              {PRESETS.map((p) => {
                const on = preset === p;
                return (
                  <Pressable key={p} onPress={() => setPreset(p)} style={[styles.choice, on && styles.pillOn]}>
                    <Text style={[styles.choiceText, on && styles.pillTextOn]}>{p}×</Text>
                  </Pressable>
                );
              })}
              <Pressable
                onPress={() => setPreset('custom')}
                style={[styles.choice, preset === 'custom' && styles.pillOn]}>
                <Text style={[styles.choiceText, preset === 'custom' && styles.pillTextOn]}>Custom</Text>
              </Pressable>
            </View>
            {preset === 'custom' ? (
              <TextInput
                style={[styles.input, { marginTop: Spacing.two }]}
                value={customTarget}
                onChangeText={(t) => setCustomTarget(t.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
                placeholder="e.g. 5"
                placeholderTextColor={palette.muted}
                maxLength={2}
              />
            ) : null}
            <Text style={styles.hint}>Weekly goal — rest days don&apos;t break the streak.</Text>

            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchLabel}>Same target for both</Text>
                <Text style={styles.switchSub}>Off lets each person set their own goal.</Text>
              </View>
              <Pressable
                onPress={() => setSameTarget((s) => !s)}
                style={[styles.toggle, sameTarget && styles.toggleOn]}>
                <View style={[styles.knob, sameTarget && styles.knobOn]} />
              </Pressable>
            </View>
            {!sameTarget ? (
              <>
                <Text style={styles.label}>Your friend&apos;s weekly target</Text>
                <TextInput
                  style={styles.input}
                  value={friendTargetInput}
                  onChangeText={(t) => setFriendTargetInput(t.replace(/[^0-9]/g, ''))}
                  keyboardType="numeric"
                  placeholder="e.g. 2"
                  placeholderTextColor={palette.muted}
                  maxLength={2}
                />
              </>
            ) : null}

            <Text style={styles.label}>If someone misses their goal</Text>
            <View style={styles.row}>
              <Pressable onPress={() => setOnMiss('reset')} style={[styles.choice, onMiss === 'reset' && styles.pillOn]}>
                <Text style={[styles.choiceText, onMiss === 'reset' && styles.pillTextOn]}>Reset to 0</Text>
              </Pressable>
              <Pressable onPress={() => setOnMiss('pause')} style={[styles.choice, onMiss === 'pause' && styles.pillOn]}>
                <Text style={[styles.choiceText, onMiss === 'pause' && styles.pillTextOn]}>Pause count</Text>
              </Pressable>
            </View>

            {/* Review */}
            <View style={styles.review}>
              <Text style={styles.reviewTitle}>Rules you&apos;re both agreeing to</Text>
              <Text style={styles.reviewLine}>• A workout counts when you complete a session in Gainz (self-reported).</Text>
              <Text style={styles.reviewLine}>• You: {myTarget || '—'} workouts/week · Friend: {friendTarget || '—'} workouts/week.</Text>
              <Text style={styles.reviewLine}>• Each cycle is 7 days, starting when your friend accepts.</Text>
              <Text style={styles.reviewLine}>
                • Miss a target and the streak {onMiss === 'reset' ? 'resets to 0' : 'pauses (count freezes)'}.
              </Text>
            </View>

            <AppButton
              label={busy ? 'Sending…' : 'Send invite'}
              icon="paper-plane"
              onPress={submit}
              disabled={!valid || busy}
              style={{ marginTop: Spacing.five }}
            />
            <Text style={styles.hint}>Your friend reviews the same rules and must accept before it starts.</Text>
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
    side: { minWidth: 60 },
    cancel: { color: palette.muted, fontSize: 16 },
    topTitle: { color: palette.fg, fontSize: 17, fontWeight: '700' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three, padding: Spacing.six },
    empty: { color: palette.muted, fontSize: 15, textAlign: 'center', lineHeight: 21 },
    content: { padding: Spacing.four, paddingBottom: Spacing.eight },

    label: { color: palette.muted, fontSize: 13, fontWeight: '700', marginTop: Spacing.four, marginBottom: Spacing.two },
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
    hint: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: Spacing.two },
    friendWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
    friendPill: {
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two + 2,
      borderRadius: Radius.full,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.surface,
    },
    friendPillText: { color: palette.fg, fontSize: 14, fontWeight: '700' },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
    choice: {
      paddingHorizontal: Spacing.four,
      paddingVertical: Spacing.two + 2,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: palette.border,
      backgroundColor: palette.surface,
    },
    choiceText: { color: palette.fg, fontSize: 15, fontWeight: '700' },
    pillOn: { backgroundColor: palette.accent, borderColor: palette.accent },
    pillTextOn: { color: palette.onAccent },

    switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, marginTop: Spacing.four },
    switchLabel: { color: palette.fg, fontSize: 15, fontWeight: '600' },
    switchSub: { color: palette.muted, fontSize: 12, marginTop: 2 },
    toggle: {
      width: 48,
      height: 28,
      borderRadius: Radius.full,
      backgroundColor: palette.surface2,
      padding: 3,
      justifyContent: 'center',
    },
    toggleOn: { backgroundColor: palette.accent },
    knob: { width: 22, height: 22, borderRadius: Radius.full, backgroundColor: palette.fg },
    knobOn: { alignSelf: 'flex-end', backgroundColor: palette.onAccent },

    review: {
      backgroundColor: palette.surface2,
      borderRadius: Radius.md,
      padding: Spacing.four,
      marginTop: Spacing.five,
      gap: Spacing.one,
    },
    reviewTitle: { color: palette.fg, fontSize: 14, fontWeight: '800', marginBottom: Spacing.one },
    reviewLine: { color: palette.muted, fontSize: 13, lineHeight: 19 },
  });
