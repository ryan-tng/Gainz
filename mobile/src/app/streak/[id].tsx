import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import { SegmentBar, streakState, useStreakColors } from '@/components/StreakBits';
import { AppButton } from '@/components/ui';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { confirmAsync, notify } from '@/lib/confirm';
import { formatDate, formatTime } from '@/lib/format';
import {
  correctCheckin,
  endsLabel,
  getStreak,
  getStreakActivity,
  reactCheckin,
  reportPhoto,
  setShareLabels,
  type ActivityEvent,
  type Reaction,
  type Streak,
} from '@/lib/social';
import { getPendingPhotos, timeLeftLabel, type PendingPhoto } from '@/lib/streakPending';
import { useTheme, useThemedStyles } from '@/store/theme';

export default function StreakDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const colors = useStreakColors();

  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState<Streak | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [pending, setPending] = useState<PendingPhoto | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [s, pend] = await Promise.all([getStreak(id), getPendingPhotos()]);
      setStreak(s);
      setPending(pend.find((p) => p.streakId === id) ?? null);
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

  const react = async (e: ActivityEvent, emoji: Reaction) => {
    const next = e.myReaction === emoji ? null : emoji;
    // optimistic
    setActivity((list) =>
      list.map((x) => {
        if (x.id !== e.id) return x;
        const r = { ...x.reactions };
        if (x.myReaction) r[x.myReaction] = Math.max(0, r[x.myReaction] - 1);
        if (next) r[next] += 1;
        return { ...x, reactions: r, myReaction: next };
      }),
    );
    try {
      await reactCheckin(e.id, next);
    } catch {
      void load();
    }
  };

  const report = async (e: ActivityEvent) => {
    if (
      await confirmAsync({
        title: 'Report this photo?',
        message:
          'We’ll review it. If someone is bothering you, you can also block them from the Friends tab, which ends your streaks with them.',
        confirmText: 'Report',
        destructive: true,
      })
    ) {
      try {
        await reportPhoto(e.id, 'Reported from streak activity');
        notify('Thanks for reporting', 'We’ll take a look.');
      } catch (err) {
        notify('Could not report', err instanceof Error ? err.message : 'Please try again.');
      }
    }
  };

  const friend = streak?.friend.profile.username ?? '';
  const p = streak?.progress;
  const state = streak ? streakState(streak) : 'pending';
  const badgeColor = state === 'risk' ? colors.risk : state === 'lost' ? colors.lost : colors.flame;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: 'transparent' }]} edges={['top', 'bottom']}>
      <AppBackground />
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={16} style={styles.side} accessibilityLabel="Back">
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
            <Ionicons name={state === 'risk' ? 'hourglass' : 'flame'} size={32} color={badgeColor} />
            <Text style={[styles.consecutive, { color: state === 'lost' ? colors.lost : palette.fg }]}>
              {state === 'lost' ? streak.lost_at_count ?? 0 : p ? p.consecutive : '—'}
            </Text>
            <Text style={styles.consecutiveLabel}>
              {state === 'lost'
                ? `Lost · it was a ${streak.lost_at_count ?? 0}-week streak with @${friend}`
                : `${p?.consecutive === 1 ? 'week' : 'weeks'} in a row · with @${friend}`}
            </Text>
            {streak.photo_required ? (
              <View style={styles.photoChip}>
                <Ionicons name="camera" size={12} color={palette.accent} />
                <Text style={styles.photoChipText}>Photo proof</Text>
              </View>
            ) : null}
          </View>

          {state === 'lost' ? (
            <>
              <Text style={[styles.hint, { textAlign: 'center' }]}>
                A week was missed, so this streak ended. Start a new one any time.
              </Text>
              <AppButton
                label="Start a new streak"
                icon="flame"
                onPress={() =>
                  router.replace({ pathname: '/streak/new', params: { friend: streak.friend.profile.user_id } })
                }
                style={{ marginTop: Spacing.four }}
              />
            </>
          ) : p ? (
            <>
              {pending ? (
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/streak/photo',
                      params: {
                        ids: streak.id,
                        label: pending.label ?? '',
                        finishedAt: String(pending.finishedAt),
                        to: `@${friend} · ${streak.name}`,
                      },
                    })
                  }
                  style={styles.pendingBanner}
                  accessibilityRole="button">
                  <Ionicons name="camera" size={20} color={palette.accent} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pendingTitle}>Snap your photo to count this workout</Text>
                    <Text style={styles.pendingSub}>{timeLeftLabel(pending.finishedAt)}</Text>
                  </View>
                  <Text style={styles.linkAccent}>Snap</Text>
                </Pressable>
              ) : null}

              <View style={styles.cycleHead}>
                <Text style={styles.cycleTitle}>Week {p.cycleIndex + 1}</Text>
                <Text style={[styles.cycleDates, p.atRisk && { color: colors.risk, fontWeight: '700' }]}>
                  {p.atRisk ? endsLabel(p) : `${formatDate(p.cycleStart)} – ${formatDate(p.cycleEnd)}`}
                </Text>
              </View>
              {[
                { who: 'You', c: p.me },
                { who: `@${friend}`, c: p.friend },
              ].map(({ who, c }) => (
                <View key={who} style={styles.barRow}>
                  <Text style={styles.barLabel} numberOfLines={1}>
                    {who}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <SegmentBar count={c.count} target={c.target} height={10} color={p.atRisk && !c.met ? colors.risk : undefined} />
                  </View>
                  <Text style={styles.barCount}>
                    {c.count}/{c.target}
                  </Text>
                </View>
              ))}
              <Text style={[styles.status, p.bothMetThisCycle && { color: palette.accent }]}>
                {p.bothMetThisCycle
                  ? `Both on track · ${endsLabel(p)}`
                  : `Both need to hit the target before the week ends (${endsLabel(p)}).`}
              </Text>

              {/* Activity log */}
              <Text style={styles.sectionLabel}>This week&apos;s activity</Text>
              {activity.length === 0 ? (
                <Text style={styles.hint}>No check-ins yet this week. Finish a workout to log one.</Text>
              ) : (
                activity.map((e) => (
                  <View key={e.id} style={styles.logCard}>
                    <View style={styles.logRow}>
                      <Ionicons
                        name={e.delta > 0 ? (e.source === 'photo' ? 'camera' : 'checkmark-circle') : 'remove-circle'}
                        size={20}
                        color={e.delta > 0 ? palette.accent : palette.muted}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.logText}>
                          {e.username}{' '}
                          {e.delta > 0
                            ? 'logged a workout'
                            : e.source === 'skip'
                              ? 'skipped a workout here'
                              : 'removed a check-in'}
                          {e.source === 'manual' ? ' (correction)' : ''}
                        </Text>
                        {e.label ? <Text style={styles.logMeta}>{e.label}</Text> : null}
                        {e.note ? <Text style={styles.logMeta}>“{e.note}”</Text> : null}
                      </View>
                      <Text style={styles.logTime}>{formatTime(new Date(e.created_at).getTime())}</Text>
                    </View>

                    {e.photoUrl ? (
                      <Image
                        source={{ uri: e.photoUrl }}
                        style={styles.photo}
                        resizeMode="cover"
                        accessibilityLabel={`Proof photo from ${e.username}`}
                      />
                    ) : e.hadPhoto ? (
                      <Text style={styles.logMeta}>Photo expired (photos are kept for 7 days).</Text>
                    ) : null}

                    {e.hadPhoto && e.delta > 0 ? (
                      <View style={styles.reactRow}>
                        {(['fire', 'muscle'] as const).map((r) => {
                          const on = e.myReaction === r;
                          const count = e.reactions[r];
                          return (
                            <Pressable
                              key={r}
                              disabled={e.mine}
                              onPress={() => react(e, r)}
                              accessibilityRole="button"
                              accessibilityLabel={`${r === 'fire' ? 'Fire' : 'Strong'} reaction${count ? `, ${count}` : ''}`}
                              accessibilityState={{ selected: on, disabled: e.mine }}
                              style={[styles.reactBtn, on && { borderColor: palette.accent }]}>
                              <Ionicons
                                name={r === 'fire' ? 'flame' : 'barbell'}
                                size={16}
                                color={on ? palette.accent : palette.muted}
                              />
                              {count ? <Text style={styles.reactCount}>{count}</Text> : null}
                            </Pressable>
                          );
                        })}
                        <View style={{ flex: 1 }} />
                        {!e.mine && e.photoUrl ? (
                          <Pressable onPress={() => report(e)} hitSlop={8} accessibilityRole="button">
                            <Text style={styles.reportText}>Report</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                ))
              )}

              {/* Correction */}
              <Text style={styles.sectionLabel}>Correct your count</Text>
              <Text style={styles.hint}>
                Check-ins are self-reported. If something&apos;s off, adjust it here. The change is
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
                <AppButton label="Add one" icon="add" onPress={() => correct(1)} disabled={busy} style={{ flex: 1 }} />
                <AppButton
                  label="Remove one"
                  icon="remove"
                  variant="secondary"
                  onPress={() => correct(-1)}
                  disabled={busy}
                  style={{ flex: 1 }}
                />
              </View>
            </>
          ) : (
            <Text style={styles.hint}>
              {streak.invitedPending
                ? 'Accept this streak from the Streaks tab to start.'
                : 'Waiting for your friend to accept before the streak starts.'}
            </Text>
          )}

          {state !== 'lost' ? (
            <>
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
              <Text style={[styles.hint, { marginTop: Spacing.four }]}>
                Streaks end on their own when a week is missed. To let this one go, uncheck it after
                your workouts.
              </Text>
            </>
          ) : null}
        </ScrollView>
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
    topTitle: { flex: 1, textAlign: 'center', color: palette.fg, fontSize: 17, fontWeight: '700' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.six },
    content: { padding: Spacing.four, paddingBottom: Spacing.eight },

    summary: { alignItems: 'center', gap: Spacing.one, paddingVertical: Spacing.four },
    consecutive: { fontSize: 48, fontWeight: '800', letterSpacing: -1 },
    consecutiveLabel: { color: palette.muted, fontSize: 14, textAlign: 'center' },
    photoChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: Radius.full,
      backgroundColor: palette.surface2,
      marginTop: Spacing.two,
    },
    photoChipText: { color: palette.accent, fontSize: 12, fontWeight: '700' },

    pendingBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.three,
      borderColor: palette.accent,
      borderWidth: 1,
      borderRadius: Radius.md,
      padding: Spacing.three,
      marginBottom: Spacing.three,
    },
    pendingTitle: { color: palette.fg, fontSize: 14, fontWeight: '700' },
    pendingSub: { color: palette.muted, fontSize: 12, marginTop: 2 },
    linkAccent: { color: palette.accent, fontSize: 14, fontWeight: '700' },

    cycleHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.two },
    cycleTitle: { color: palette.fg, fontSize: 16, fontWeight: '800' },
    cycleDates: { color: palette.muted, fontSize: 13 },

    barRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: Spacing.three },
    barLabel: { color: palette.muted, fontSize: 13, width: 72 },
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

    logCard: {
      backgroundColor: palette.surface,
      borderColor: palette.border,
      borderWidth: 1,
      borderRadius: Radius.md,
      padding: Spacing.three,
      marginBottom: Spacing.two,
      gap: Spacing.two,
    },
    logRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
    logText: { color: palette.fg, fontSize: 14, fontWeight: '600' },
    logMeta: { color: palette.muted, fontSize: 12, marginTop: 1 },
    logTime: { color: palette.muted, fontSize: 12 },
    photo: { width: '100%', aspectRatio: 3 / 4, borderRadius: Radius.md, backgroundColor: palette.surface2 },
    reactRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
    reactBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      minHeight: 36,
      minWidth: 44,
      paddingHorizontal: Spacing.three,
      borderRadius: Radius.full,
      borderWidth: 1,
      borderColor: palette.border,
      justifyContent: 'center',
    },
    reactCount: { color: palette.fg, fontSize: 13, fontWeight: '700' },
    reportText: { color: palette.muted, fontSize: 13, fontWeight: '600' },

    switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
    switchLabel: { color: palette.fg, fontSize: 15, fontWeight: '600' },
    switchSub: { color: palette.muted, fontSize: 12, marginTop: 2, lineHeight: 17 },
  });
