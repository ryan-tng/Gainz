import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBackground } from '@/components/AppBackground';
import { AppButton } from '@/components/ui';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { confirmAsync, notify } from '@/lib/confirm';
import { formatDate, formatTime } from '@/lib/format';
import {
  correctCheckin,
  getStreak,
  getStreakActivity,
  leaveStreak,
  setShareLabels,
  type ActivityEvent,
  type Streak,
} from '@/lib/social';
import { useTheme, useThemedStyles } from '@/store/theme';

export default function StreakDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState<Streak | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const s = await getStreak(id);
      setStreak(s);
      if (s?.progress) setActivity(await getStreakActivity(id, s.progress.cycleIndex));
      else setActivity([]);
    } catch {
      // leave as-is
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const correct = async (delta: 1 | -1) => {
    if (!streak || busy) return;
    if (!note.trim()) {
      notify('Add a note', 'A short note helps your friend see what changed.');
      return;
    }
    setBusy(true);
    try {
      await correctCheckin(streak.id, delta, note);
      setNote('');
      await load();
    } catch (e) {
      notify('Could not save correction', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const toggleLabels = async (on: boolean) => {
    if (!streak) return;
    setStreak({ ...streak, me: { ...streak.me, shareLabels: on } }); // optimistic
    try {
      await setShareLabels(streak.id, on);
    } catch (e) {
      setStreak({ ...streak, me: { ...streak.me, shareLabels: !on } }); // revert
      notify('Could not update sharing', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  const leave = async () => {
    if (!streak) return;
    if (
      await confirmAsync({
        title: 'Leave streak?',
        message: `Leaving ends "${streak.name}" for both you and @${streak.friend.profile.username}.`,
        confirmText: 'Leave',
        destructive: true,
      })
    ) {
      try {
        await leaveStreak(streak.id);
        router.back();
      } catch (e) {
        notify('Could not leave', e instanceof Error ? e.message : 'Please try again.');
      }
    }
  };

  const friend = streak?.friend.profile.username ?? '';
  const p = streak?.progress;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: 'transparent' }]} edges={['top', 'bottom']}>
      <AppBackground />
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={16} style={styles.side}>
          <Ionicons name="chevron-back" size={26} color={palette.fg} />
        </Pressable>
        <Text style={styles.topTitle} numberOfLines={1}>
          {streak?.name ?? 'Streak'}
        </Text>
        <View style={styles.side} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.accent} />
        </View>
      ) : !streak ? (
        <View style={styles.center}>
          <Text style={styles.hint}>This streak is no longer available.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Summary */}
          <View style={styles.summary}>
            <Ionicons name="flame" size={28} color={palette.accent} />
            <Text style={styles.consecutive}>
              {p ? (p.consecutive > 0 ? `${p.consecutive}` : '0') : '—'}
            </Text>
            <Text style={styles.consecutiveLabel}>
              {p && p.consecutive === 1 ? 'cycle streak' : 'cycle streak'} · with @{friend}
            </Text>
          </View>

          {p ? (
            <>
              <View style={styles.cycleHead}>
                <Text style={styles.cycleTitle}>Cycle {p.cycleIndex + 1}</Text>
                <Text style={styles.cycleDates}>
                  {formatDate(p.cycleStart)} – {formatDate(p.cycleEnd)}
                </Text>
              </View>
              <Bar label="You" count={p.me.count} target={p.me.target} palette={palette} styles={styles} />
              <Bar
                label={`@${friend}`}
                count={p.friend.count}
                target={p.friend.target}
                palette={palette}
                styles={styles}
              />
              <Text style={[styles.status, p.bothMetThisCycle && { color: palette.accent }]}>
                {p.bothMetThisCycle ? 'Both on track this cycle ✓' : 'Keep going to keep the streak'}
              </Text>

              {/* Correction */}
              <Text style={styles.sectionLabel}>Correct your count</Text>
              <Text style={styles.hint}>
                Check-ins are self-reported. If something&apos;s off, adjust it here — the change is
                logged and shown to @{friend}.
              </Text>
              <TextInput
                style={styles.input}
                value={note}
                onChangeText={setNote}
                placeholder="Reason (e.g. logged a gym session I forgot)"
                placeholderTextColor={palette.muted}
                maxLength={200}
              />
              <View style={styles.correctRow}>
                <AppButton
                  label="Add one"
                  icon="add"
                  onPress={() => correct(1)}
                  disabled={busy}
                  style={{ flex: 1 }}
                />
                <AppButton
                  label="Remove one"
                  icon="remove"
                  variant="secondary"
                  onPress={() => correct(-1)}
                  disabled={busy}
                  style={{ flex: 1 }}
                />
              </View>

              {/* Activity log */}
              <Text style={styles.sectionLabel}>This cycle&apos;s activity</Text>
              {activity.length === 0 ? (
                <Text style={styles.hint}>No check-ins yet this cycle. Finish a workout to log one.</Text>
              ) : (
                activity.map((e) => (
                  <View key={e.id} style={styles.logRow}>
                    <Ionicons
                      name={e.delta > 0 ? 'checkmark-circle' : 'remove-circle'}
                      size={20}
                      color={e.delta > 0 ? palette.accent : palette.danger}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.logText}>
                        {e.username} {e.delta > 0 ? 'logged a workout' : 'removed a check-in'}
                        {e.source === 'manual' ? ' (correction)' : ''}
                      </Text>
                      {e.label ? <Text style={styles.logMeta}>{e.label}</Text> : null}
                      {e.note ? <Text style={styles.logMeta}>“{e.note}”</Text> : null}
                    </View>
                    <Text style={styles.logTime}>{formatTime(new Date(e.created_at).getTime())}</Text>
                  </View>
                ))
              )}
            </>
          ) : (
            <Text style={styles.hint}>
              {streak.invitedPending
                ? 'Accept this streak from the Social screen to start.'
                : 'Waiting for your friend to accept before the streak starts.'}
            </Text>
          )}

          {/* Settings */}
          <Text style={styles.sectionLabel}>Settings</Text>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>Share exercise labels</Text>
              <Text style={styles.switchSub}>
                Let @{friend} see what you worked out, not just your count.
              </Text>
            </View>
            <Switch
              value={streak.me.shareLabels}
              onValueChange={toggleLabels}
              trackColor={{ false: palette.surface2, true: palette.accent }}
              thumbColor={palette.fg}
            />
          </View>

          <AppButton
            label="Leave streak"
            icon="exit-outline"
            variant="danger"
            onPress={leave}
            style={{ marginTop: Spacing.five }}
          />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Bar({
  label,
  count,
  target,
  palette,
  styles,
}: {
  label: string;
  count: number;
  target: number;
  palette: Palette;
  styles: ReturnType<typeof makeStyles>;
}) {
  const pct = target > 0 ? Math.min(1, count / target) : 0;
  const met = count >= target;
  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            { width: `${pct * 100}%`, backgroundColor: met ? palette.accent : palette.accent2 },
          ]}
        />
      </View>
      <Text style={styles.barCount}>
        {count}/{target}
      </Text>
    </View>
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
    topTitle: { flex: 1, textAlign: 'center', color: palette.fg, fontSize: 17, fontWeight: '700' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.six },
    content: { padding: Spacing.four, paddingBottom: Spacing.eight },

    summary: { alignItems: 'center', gap: Spacing.one, paddingVertical: Spacing.four },
    consecutive: { color: palette.fg, fontSize: 44, fontWeight: '800', letterSpacing: -1 },
    consecutiveLabel: { color: palette.muted, fontSize: 14 },

    cycleHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.two },
    cycleTitle: { color: palette.fg, fontSize: 16, fontWeight: '800' },
    cycleDates: { color: palette.muted, fontSize: 13 },

    barRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: Spacing.three },
    barLabel: { color: palette.muted, fontSize: 13, width: 72 },
    barTrack: { flex: 1, height: 10, borderRadius: Radius.full, backgroundColor: palette.surface2, overflow: 'hidden' },
    barFill: { height: '100%', borderRadius: Radius.full },
    barCount: { color: palette.fg, fontSize: 13, fontWeight: '700', width: 44, textAlign: 'right' },
    status: { color: palette.muted, fontSize: 13, fontWeight: '700', marginTop: Spacing.three, textAlign: 'center' },

    sectionLabel: { color: palette.muted, fontSize: 13, fontWeight: '700', marginTop: Spacing.five, marginBottom: Spacing.two },
    hint: { color: palette.muted, fontSize: 13, lineHeight: 19 },
    input: {
      color: palette.fg,
      fontSize: 15,
      backgroundColor: palette.surface,
      borderColor: palette.border,
      borderWidth: 1,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.three,
      marginTop: Spacing.two,
    },
    correctRow: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },

    logRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.three,
      backgroundColor: palette.surface,
      borderColor: palette.border,
      borderWidth: 1,
      borderRadius: Radius.md,
      padding: Spacing.three,
      marginBottom: Spacing.two,
    },
    logText: { color: palette.fg, fontSize: 14, fontWeight: '600' },
    logMeta: { color: palette.muted, fontSize: 12, marginTop: 1 },
    logTime: { color: palette.muted, fontSize: 12 },

    switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
    switchLabel: { color: palette.fg, fontSize: 15, fontWeight: '600' },
    switchSub: { color: palette.muted, fontSize: 12, marginTop: 2, lineHeight: 17 },
  });
