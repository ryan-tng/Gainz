import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { InitialAvatar, SegmentBar, StreakBadge, useStreakColors } from '@/components/StreakBits';
import { AppButton } from '@/components/ui';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import {
  checkInStreak,
  endsLabel,
  listCheckinTargets,
  skipCheckin,
  type Streak,
} from '@/lib/social';
import { addPendingPhotos } from '@/lib/streakPending';
import { useTheme, useThemedStyles } from '@/store/theme';

type Mode = 'idle' | 'sheet' | 'edit';
interface Toast {
  title: string;
  sub?: string;
  edit?: boolean;
}

/**
 * Post-workout streak check-in. Mounted on the finished workout's screen.
 *
 * - No active streaks: renders nothing.
 * - No photo streaks: counts the workout toward all of them right away and
 *   shows a toast with "Edit" (uncheck a streak to skip it this time).
 * - Any photo streak: ONE sheet with a checklist. Non-photo streaks count when
 *   you tap the button; photo streaks count once the in-app photo is sent.
 *
 * Skipping a friend workout after workout is how a streak ends (no Leave).
 */
export function StreakCheckIn({ label, finishedAt }: { label: string | null; finishedAt: number }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const colors = useStreakColors();

  const [targets, setTargets] = useState<Streak[]>([]);
  const [mode, setMode] = useState<Mode>('idle');
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [counted, setCounted] = useState<string[]>([]); // auto-counted (toast flow)
  const [toast, setToast] = useState<Toast | null>(null);
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  const countAll = async (ids: string[]) => {
    const results = await Promise.allSettled(ids.map((id) => checkInStreak(id, label)));
    return ids.filter((_, i) => results[i].status === 'fulfilled');
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const t = await listCheckinTargets();
        if (t.length === 0) return;
        setTargets(t);
        setChecked(Object.fromEntries(t.map((s) => [s.id, true])));
        if (t.some((s) => s.photo_required)) {
          setMode('sheet');
          return;
        }
        const ok = await countAll(t.map((s) => s.id));
        setCounted(ok);
        if (ok.length) {
          setToast({
            title: `Counted toward ${ok.length} streak${ok.length === 1 ? '' : 's'}`,
            sub: t.filter((s) => ok.includes(s.id)).map((s) => s.name).join(', '),
            edit: true,
          });
        }
      } catch {
        // Streak credit must never get in the way of finishing a workout.
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Toast fades after a few seconds unless the user opened Edit.
  useEffect(() => {
    if (!toast || mode !== 'idle') return;
    const t = setTimeout(() => setToast(null), toast.edit ? 7000 : 5000);
    return () => clearTimeout(t);
  }, [toast, mode]);

  const rows = mode === 'edit' ? targets.filter((s) => counted.includes(s.id)) : targets;
  const checkedRows = rows.filter((s) => checked[s.id]);
  const photoChecked = mode === 'sheet' ? checkedRows.filter((s) => s.photo_required) : [];
  const plainChecked = mode === 'sheet' ? checkedRows.filter((s) => !s.photo_required) : [];
  const needPhoto = photoChecked.length > 0;

  const hint =
    checkedRows.length === 0
      ? 'Nothing selected. This workout won’t count toward any streak.'
      : needPhoto
        ? `${photoChecked.length === 1 ? `@${photoChecked[0].friend.profile.username}’s streak needs` : `${photoChecked.length} streaks need`} a photo.${plainChecked.length ? ' The others count right away.' : ''}`
        : `Counts toward ${checkedRows.length} streak${checkedRows.length === 1 ? '' : 's'}.`;

  const pendingFor = (list: Streak[]) =>
    list.map((s) => ({
      streakId: s.id,
      streakName: s.name,
      friend: s.friend.profile.username,
      label,
      finishedAt,
    }));

  /** Sheet actions: 'photo' opens the camera, 'later' postpones photo streaks, 'done' = no photo needed. */
  const submitSheet = async (action: 'photo' | 'later' | 'done') => {
    if (busy) return;
    setBusy(true);
    try {
      const ok = await countAll(plainChecked.map((s) => s.id));
      if (needPhoto) await addPendingPhotos(pendingFor(photoChecked));
      setMode('idle');
      if (action === 'photo' && needPhoto) {
        const to =
          photoChecked.length === 1
            ? `@${photoChecked[0].friend.profile.username} · ${photoChecked[0].name}`
            : `${photoChecked.length} streaks`;
        const params = {
          ids: photoChecked.map((s) => s.id).join(','),
          label: label ?? '',
          finishedAt: String(finishedAt),
          to,
        };
        // Let the sheet finish sliding away first: iOS won't present the
        // full-screen camera while another modal is still dismissing.
        setTimeout(() => router.push({ pathname: '/streak/photo', params }), 450);
      } else if (action === 'later' && needPhoto) {
        setToast({
          title: 'Photo streaks are waiting',
          sub: 'You have 2 hours to snap it from the Streaks screen.',
        });
      } else if (ok.length) {
        setToast({ title: `Counted toward ${ok.length} streak${ok.length === 1 ? '' : 's'}` });
      }
    } finally {
      setBusy(false);
    }
  };

  /** Edit (toast flow): skip the streaks the user unchecked. */
  const submitEdit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const skip = counted.filter((id) => !checked[id]);
      await Promise.allSettled(skip.map((id) => skipCheckin(id)));
      const left = counted.filter((id) => checked[id]);
      setCounted(left);
      setMode('idle');
      setToast(
        left.length
          ? { title: `Counted toward ${left.length} streak${left.length === 1 ? '' : 's'}` }
          : { title: 'Skipped for this workout' },
      );
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    // Swiping the sheet away behaves like "Later" so nothing is lost silently.
    if (mode === 'sheet') void submitSheet('later');
    else setMode('idle');
  };

  return (
    <>
      {toast && mode === 'idle' ? (
        <View
          pointerEvents="box-none"
          style={[styles.toastWrap, { bottom: Math.max(insets.bottom, Spacing.three) + Spacing.three }]}>
          <View style={styles.toast} accessibilityRole="alert">
            <View style={styles.toastIcon}>
              <Ionicons name="checkmark" size={18} color={palette.onAccent} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.toastTitle}>{toast.title}</Text>
              {toast.sub ? (
                <Text style={styles.toastSub} numberOfLines={2}>
                  {toast.sub}
                </Text>
              ) : null}
            </View>
            {toast.edit ? (
              <Pressable
                onPress={() => {
                  setChecked(Object.fromEntries(counted.map((id) => [id, true])));
                  setMode('edit');
                }}
                hitSlop={8}
                style={styles.toastBtn}
                accessibilityRole="button">
                <Text style={styles.toastBtnText}>Edit</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      <Modal visible={mode !== 'idle'} transparent animationType="slide" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Close" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, Spacing.four) + Spacing.two }]}>
          <View style={styles.grabber} />
          <View style={styles.head}>
            <View style={styles.headIcon}>
              <Ionicons name="checkmark" size={22} color={palette.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.headTitle}>{mode === 'edit' ? 'Edit streak check-in' : 'Workout complete'}</Text>
              {label ? <Text style={styles.headSub}>{label}</Text> : null}
            </View>
          </View>

          <Text style={styles.sectionLabel}>COUNT IT TOWARD</Text>
          <ScrollView style={{ maxHeight: 340 }} contentContainerStyle={{ gap: Spacing.two }}>
            {rows.map((s) => {
              const on = !!checked[s.id];
              const p = s.progress!;
              const friend = s.friend.profile.username;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => setChecked((c) => ({ ...c, [s.id]: !c[s.id] }))}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`${s.name} with ${friend}`}
                  style={[styles.row, { borderColor: on ? palette.accent : palette.border }]}>
                  <InitialAvatar name={friend} />
                  <View style={{ flex: 1, minWidth: 0, gap: 7 }}>
                    <View style={styles.rowTop}>
                      <Text style={styles.rowName} numberOfLines={1}>
                        @{friend}
                      </Text>
                      <StreakBadge streak={s} size={15} />
                      <View style={{ flex: 1 }} />
                      {s.photo_required && mode === 'sheet' ? (
                        <View style={styles.photoTag}>
                          <Ionicons name="camera" size={12} color={palette.accent} />
                          <Text style={styles.photoTagText}>Photo</Text>
                        </View>
                      ) : null}
                    </View>
                    <SegmentBar count={p.me.count} target={p.me.target} preview={on} />
                    <Text
                      style={[styles.rowMeta, p.atRisk && { color: colors.risk }]}
                      numberOfLines={1}>
                      {s.name} · {p.me.count} of {p.me.target} · {endsLabel(p)}
                    </Text>
                  </View>
                  <View style={[styles.box, on ? { backgroundColor: palette.accent, borderColor: palette.accent } : null]}>
                    {on ? <Ionicons name="checkmark" size={16} color={palette.onAccent} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
          <Text style={styles.hint}>{hint}</Text>

          {mode === 'edit' ? (
            <AppButton label={busy ? 'Saving…' : 'Done'} onPress={submitEdit} disabled={busy} style={styles.primary} />
          ) : needPhoto ? (
            <>
              <AppButton
                label="Take photo & send"
                icon="camera"
                onPress={() => submitSheet('photo')}
                disabled={busy}
                style={styles.primary}
              />
              <Pressable onPress={() => submitSheet('later')} disabled={busy} style={styles.later} accessibilityRole="button">
                <Text style={styles.laterText}>Later (2 hours to snap it)</Text>
              </Pressable>
            </>
          ) : (
            <AppButton
              label={busy ? 'Saving…' : 'Done'}
              onPress={() => submitSheet('done')}
              disabled={busy}
              style={styles.primary}
            />
          )}
        </View>
      </Modal>
    </>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    toastWrap: { position: 'absolute', left: Spacing.four, right: Spacing.four },
    toast: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.three,
      backgroundColor: palette.surface2,
      borderColor: palette.border,
      borderWidth: 1,
      borderRadius: Radius.lg,
      paddingVertical: Spacing.three,
      paddingLeft: Spacing.three,
      paddingRight: Spacing.two,
      shadowColor: '#000',
      shadowOpacity: 0.35,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    },
    toastIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: palette.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    toastTitle: { color: palette.fg, fontSize: 15, fontWeight: '700' },
    toastSub: { color: palette.muted, fontSize: 13, marginTop: 2 },
    toastBtn: { minHeight: 44, paddingHorizontal: Spacing.three, justifyContent: 'center' },
    toastBtnText: { color: palette.accent, fontSize: 15, fontWeight: '700' },

    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
    sheet: {
      backgroundColor: palette.surface,
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      borderColor: palette.border,
      borderTopWidth: 1,
      paddingHorizontal: Spacing.four,
      paddingTop: Spacing.two,
    },
    grabber: {
      width: 40,
      height: 5,
      borderRadius: 3,
      backgroundColor: palette.border,
      alignSelf: 'center',
      marginBottom: Spacing.three,
    },
    head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, marginBottom: Spacing.four },
    headIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: palette.surface2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headTitle: { color: palette.fg, fontSize: 21, fontWeight: '800', letterSpacing: -0.3 },
    headSub: { color: palette.muted, fontSize: 14, marginTop: 2 },
    sectionLabel: {
      color: palette.muted,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.8,
      marginBottom: Spacing.two,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.three,
      backgroundColor: palette.surface2,
      borderWidth: 1.5,
      borderRadius: Radius.lg,
      paddingVertical: Spacing.three,
      paddingHorizontal: Spacing.three,
    },
    rowTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
    rowName: { color: palette.fg, fontSize: 16, fontWeight: '700', flexShrink: 1 },
    rowMeta: { color: palette.muted, fontSize: 13 },
    photoTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: Radius.full,
      backgroundColor: palette.bg,
    },
    photoTagText: { color: palette.accent, fontSize: 12, fontWeight: '700' },
    box: {
      width: 26,
      height: 26,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: palette.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    hint: { color: palette.muted, fontSize: 13, lineHeight: 18, marginTop: Spacing.three },
    primary: { marginTop: Spacing.four },
    later: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.one },
    laterText: { color: palette.muted, fontSize: 15, fontWeight: '600' },
  });
