import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExercisePickerModal } from '@/components/ExercisePickerModal';
import { AppButton, Card, Loading } from '@/components/ui';
import { palette, Radius, Spacing } from '@/constants/theme';
import { formatDate, formatVolume } from '@/lib/format';
import { computeDashboard } from '@/lib/stats';
import { sessionStats, type SetEntry, type WorkoutExercise, type WorkoutSession } from '@/lib/types';
import { useWorkouts } from '@/store/workouts';

const numOrNull = (t: string): number | null => {
  const cleaned = t.replace(/[^0-9.]/g, '');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

/** Compact "135×8 · 135×8" summary of an exercise's sets. */
function setsSummary(sets: SetEntry[]): string | null {
  const parts = sets
    .map((s) => {
      if (s.weight !== null && s.reps !== null) return `${s.weight}×${s.reps}`;
      if (s.reps !== null) return `${s.reps} reps`;
      if (s.weight !== null) return `${s.weight} lb`;
      return null;
    })
    .filter((p): p is string => p !== null);
  return parts.length ? parts.join(' · ') : null;
}

export default function HomeScreen() {
  const { loaded, active } = useWorkouts();
  // Lets a paused workout be "minimized" so you can browse the dashboard.
  const [minimized, setMinimized] = useState(false);

  // Whenever there's no active workout, drop back to the normal dashboard.
  useEffect(() => {
    if (!active) setMinimized(false);
  }, [active]);

  if (!loaded) return <Loading />;
  // When a workout is running, the whole home screen becomes the live session,
  // unless the user chose to peek at the dashboard while paused.
  if (active && !minimized) {
    return <ActiveWorkoutHome active={active} onMinimize={() => setMinimized(true)} />;
  }
  return <Dashboard onResumeView={() => setMinimized(false)} />;
}

/* ------------------------------------------------------------------ */
/* Active workout takeover                                            */
/* ------------------------------------------------------------------ */

function fmtElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

function ActiveWorkoutHome({
  active,
  onMinimize,
}: {
  active: WorkoutSession;
  onMinimize: () => void;
}) {
  const router = useRouter();
  const {
    exercises,
    finishWorkout,
    cancelWorkout,
    togglePause,
    updateSet,
    addSet,
    removeSet,
    setExerciseDone,
    addExercisesToActive,
    removeWorkoutExercise,
  } = useWorkouts();
  const [now, setNow] = useState(Date.now());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const editing = active.exercises.find((e) => e.id === editingId) ?? null;

  // Tick the elapsed timer once a second.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const color = active.color ?? palette.accent;
  const icon = (active.icon ?? 'barbell') as keyof typeof Ionicons.glyphMap;

  const isPaused = active.pausedAt != null;
  const elapsed = (isPaused ? (active.pausedAt as number) : now) - active.startedAt - (active.pausedMs ?? 0);

  let totalSets = 0;
  let doneSets = 0;
  let volume = 0;
  for (const ex of active.exercises) {
    for (const s of ex.sets) {
      totalSets += 1;
      if (s.done) {
        doneSets += 1;
        volume += (s.weight ?? 0) * (s.reps ?? 0);
      }
    }
  }
  const progress = totalSets ? doneSets / totalSets : 0;

  const onFinish = () => {
    if (active.exercises.length === 0 || doneSets === 0) {
      Alert.alert(
        'Finish workout?',
        doneSets === 0 ? 'You have no completed sets yet.' : 'Save this workout?',
        [
          { text: 'Keep going', style: 'cancel' },
          {
            text: 'Finish',
            onPress: () => {
              const id = finishWorkout();
              if (id) router.push(`/session/${id}`);
            },
          },
        ],
      );
      return;
    }
    const id = finishWorkout();
    if (id) router.push(`/session/${id}`);
  };

  const onDiscard = () => {
    Alert.alert('Discard workout?', 'This workout will not be saved.', [
      { text: 'Keep going', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => cancelWorkout() },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Live hero */}
        <View style={[styles.hero, { backgroundColor: `${color}18`, borderColor: `${color}55` }]}>
          <View style={styles.heroTop}>
            <View style={[styles.heroIcon, { backgroundColor: `${color}22` }]}>
              <Ionicons name={icon} size={22} color={color} />
            </View>
            <View style={styles.liveRow}>
              <View style={[styles.liveDot, { backgroundColor: isPaused ? palette.muted : color }]} />
              <Text style={[styles.liveLabel, { color: isPaused ? palette.muted : color }]}>
                {isPaused ? 'Paused' : 'In progress'}
              </Text>
            </View>
          </View>

          <Text style={[styles.timer, isPaused && { color: palette.muted }]}>
            {fmtElapsed(elapsed)}
          </Text>
          <Text style={styles.heroName} numberOfLines={1}>
            {active.name}
          </Text>

          <View style={styles.progressTrack}>
            <View
              style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: color }]}
            />
          </View>
          <Text style={styles.progressText}>
            {doneSets} of {totalSets} set{totalSets === 1 ? '' : 's'} done
          </Text>
        </View>

        {/* Live stats */}
        <View style={styles.miniRow}>
          <Mini value={String(active.exercises.length)} label="exercises" />
          <Mini value={String(doneSets)} label="sets done" accent={color} />
          <Mini value={formatVolume(volume)} label="volume" />
        </View>

        {/* Pause / resume */}
        <Pressable
          onPress={togglePause}
          style={({ pressed }) => [
            styles.pauseBtn,
            isPaused
              ? { backgroundColor: color }
              : { backgroundColor: palette.surface, borderColor: palette.border, borderWidth: 1 },
            { opacity: pressed ? 0.85 : 1 },
          ]}>
          <Ionicons
            name={isPaused ? 'play' : 'pause'}
            size={18}
            color={isPaused ? palette.onAccent : palette.fg}
          />
          <Text style={[styles.pauseText, { color: isPaused ? palette.onAccent : palette.fg }]}>
            {isPaused ? 'Resume workout' : 'Pause workout'}
          </Text>
        </Pressable>

        {isPaused ? (
          <AppButton
            label="Back to dashboard"
            icon="home-outline"
            variant="secondary"
            onPress={onMinimize}
            style={{ marginTop: Spacing.two }}
          />
        ) : null}

        {/* Exercise checklist */}
        <Text style={styles.sectionTitle}>This session</Text>
        {active.exercises.length === 0 ? (
          <Card>
            <Text style={styles.emptyBody}>
              No exercises yet. Tap &quot;Add exercise&quot; below to get started.
            </Text>
          </Card>
        ) : (
          active.exercises.map((ex) => {
            const total = ex.sets.length;
            const done = ex.sets.filter((s) => s.done).length;
            const complete = total > 0 && done === total;
            const summary = setsSummary(ex.sets);
            return (
              <View key={ex.id} style={styles.exRow}>
                {/* Tap the circle to mark the whole exercise complete. */}
                <Pressable
                  onPress={() => setExerciseDone(ex.id, !complete)}
                  hitSlop={8}
                  style={[
                    styles.exCheck,
                    complete && { backgroundColor: color, borderColor: color },
                  ]}>
                  {complete ? (
                    <Ionicons name="checkmark" size={16} color={palette.onAccent} />
                  ) : (
                    <Text style={styles.exCheckText}>
                      {done}/{total}
                    </Text>
                  )}
                </Pressable>

                {/* Tap the body to edit this exercise's sets. */}
                <Pressable style={styles.exBody} onPress={() => setEditingId(ex.id)}>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.exName, complete && styles.exNameDone]}
                      numberOfLines={1}>
                      {ex.name}
                    </Text>
                    <Text style={styles.exMeta} numberOfLines={1}>
                      {summary ?? `${total} set${total === 1 ? '' : 's'} · tap to set weight & reps`}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={palette.muted} />
                </Pressable>
              </View>
            );
          })
        )}

        <AppButton
          label="Add exercise"
          icon="add"
          variant="secondary"
          onPress={() => setAdding(true)}
          style={{ marginTop: Spacing.two }}
        />
        <AppButton
          label="Finish workout"
          icon="checkmark-done"
          onPress={onFinish}
          style={{ marginTop: Spacing.four }}
        />
        <AppButton label="Discard" icon="trash-outline" variant="danger" onPress={onDiscard} />
      </ScrollView>

      <Modal
        visible={!!editing}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditingId(null)}>
        {editing ? (
          <ExerciseEditor
            we={editing}
            color={color}
            onClose={() => setEditingId(null)}
            onRemove={() => {
              removeWorkoutExercise(editing.id);
              setEditingId(null);
            }}
            updateSet={updateSet}
            addSet={addSet}
            removeSet={removeSet}
            setExerciseDone={setExerciseDone}
          />
        ) : null}
      </Modal>

      <ExercisePickerModal
        visible={adding}
        exercises={exercises}
        disabledIds={new Set(active.exercises.map((e) => e.exerciseId))}
        onClose={() => setAdding(false)}
        onConfirm={(ids) => {
          addExercisesToActive(ids);
          setAdding(false);
        }}
      />
    </SafeAreaView>
  );
}

/* ------------------------------------------------------------------ */
/* Per-exercise set editor (opens from the session list)             */
/* ------------------------------------------------------------------ */

function ExerciseEditor({
  we,
  color,
  onClose,
  onRemove,
  updateSet,
  addSet,
  removeSet,
  setExerciseDone,
}: {
  we: WorkoutExercise;
  color: string;
  onClose: () => void;
  onRemove: () => void;
  updateSet: (
    weId: string,
    setId: string,
    patch: Partial<Pick<SetEntry, 'weight' | 'reps' | 'done'>>,
  ) => void;
  addSet: (weId: string) => void;
  removeSet: (weId: string, setId: string) => void;
  setExerciseDone: (weId: string, done: boolean) => void;
}) {
  const total = we.sets.length;
  const done = we.sets.filter((s) => s.done).length;
  const allDone = total > 0 && done === total;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.editTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.editTitle} numberOfLines={1}>
            {we.name}
          </Text>
          <Text style={styles.editSubtitle}>{we.muscle}</Text>
        </View>
        <Pressable onPress={onClose} hitSlop={10}>
          <Text style={[styles.editDone, { color }]}>Done</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={8}>
        <ScrollView
          contentContainerStyle={styles.editContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.setHeadRow}>
            <Text style={[styles.setHeadText, styles.colSet]}>Set</Text>
            <Text style={[styles.setHeadText, styles.colInput]}>lb</Text>
            <Text style={[styles.setHeadText, styles.colInput]}>Reps</Text>
            <Text style={[styles.setHeadText, styles.colDone]}>✓</Text>
          </View>

          {we.sets.map((s, i) => (
            <View key={s.id} style={styles.editSetRow}>
              <Text style={[styles.setIndex, styles.colSet]}>{i + 1}</Text>
              <TextInput
                style={[styles.setInput, styles.colInput]}
                keyboardType="numeric"
                placeholder="—"
                placeholderTextColor={palette.muted}
                value={s.weight === null ? '' : String(s.weight)}
                onChangeText={(t) => updateSet(we.id, s.id, { weight: numOrNull(t) })}
              />
              <TextInput
                style={[styles.setInput, styles.colInput]}
                keyboardType="numeric"
                placeholder="—"
                placeholderTextColor={palette.muted}
                value={s.reps === null ? '' : String(s.reps)}
                onChangeText={(t) => updateSet(we.id, s.id, { reps: numOrNull(t) })}
              />
              <Pressable
                style={[styles.colDone, styles.checkWrap]}
                onPress={() => updateSet(we.id, s.id, { done: !s.done })}
                onLongPress={() => removeSet(we.id, s.id)}>
                <View
                  style={[styles.check, s.done && { backgroundColor: color, borderColor: color }]}>
                  {s.done ? <Ionicons name="checkmark" size={16} color={palette.onAccent} /> : null}
                </View>
              </Pressable>
            </View>
          ))}

          <Pressable style={styles.addSet} onPress={() => addSet(we.id)}>
            <Ionicons name="add" size={16} color={palette.accent} />
            <Text style={styles.addSetText}>Add set</Text>
          </Pressable>

          <Text style={styles.editHint}>Long-press a ✓ to delete that set.</Text>

          <Pressable
            style={({ pressed }) => [
              styles.markComplete,
              { borderColor: color, opacity: pressed ? 0.85 : 1 },
              allDone && { backgroundColor: color },
            ]}
            onPress={() => setExerciseDone(we.id, !allDone)}>
            <Ionicons
              name={allDone ? 'checkmark-done' : 'ellipse-outline'}
              size={18}
              color={allDone ? palette.onAccent : color}
            />
            <Text
              style={[styles.markCompleteText, { color: allDone ? palette.onAccent : color }]}>
              {allDone ? 'Exercise complete' : 'Mark exercise complete'}
            </Text>
          </Pressable>

          <AppButton
            label="Remove from workout"
            icon="trash-outline"
            variant="danger"
            onPress={onRemove}
            style={{ marginTop: Spacing.three }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Mini({ value, label, accent }: { value: string; label: string; accent?: string }) {
  return (
    <View style={styles.mini}>
      <Text style={[styles.miniValue, accent ? { color: accent } : null]}>{value}</Text>
      <Text style={styles.miniLabel}>{label}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Dashboard (no active workout)                                      */
/* ------------------------------------------------------------------ */

function Dashboard({ onResumeView }: { onResumeView: () => void }) {
  const router = useRouter();
  const { active, sessions, templates, startWorkout, startFromTemplate } = useWorkouts();

  const d = computeDashboard(sessions);
  const recent = sessions.slice(0, 3);
  const maxBar = Math.max(1, ...d.last7.map((b) => b.value));

  // Starting a workout just flips Home into the live takeover (like clocking in) —
  // the logging screen opens from the takeover's "Continue logging" button.
  const startEmpty = () => startWorkout();
  const startTemplate = (id: string) => startFromTemplate(id);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.brandRow}>
          <View style={styles.logo}>
            <Ionicons name="barbell" size={20} color={palette.onAccent} />
          </View>
          <Text style={styles.brand}>Gainz</Text>
        </View>

        {active ? <ResumeCard active={active} onPress={onResumeView} /> : null}

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          <Stat value={String(d.thisWeek)} label="This week" unit="workouts" />
          <Stat
            value={String(d.weekStreak)}
            label="Week streak"
            unit={d.weekStreak === 1 ? 'week' : 'weeks'}
            accent
          />
          <Stat value={String(d.totalWorkouts)} label="All time" unit="workouts" />
          <Stat value={formatVolume(d.totalVolume)} label="Volume" unit="lifted" />
        </View>

        {/* 7-day activity */}
        <Card style={styles.chartCard}>
          <Text style={styles.cardTitle}>Last 7 days</Text>
          <View style={styles.chart}>
            {d.last7.map((b, i) => (
              <View key={i} style={styles.barCol}>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        height: `${Math.max(4, (b.value / maxBar) * 100)}%`,
                        backgroundColor: b.value > 0 ? palette.accent : palette.surface2,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.barLabel, b.isToday && { color: palette.accent }]}>
                  {b.label}
                </Text>
              </View>
            ))}
          </View>
        </Card>

        {/* Templates — pick a workout to run */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Your workouts</Text>
          <Pressable onPress={() => router.push('/template/edit')} hitSlop={8}>
            <Text style={styles.link}>+ New</Text>
          </Pressable>
        </View>

        {templates.length === 0 ? (
          <Card>
            <Text style={styles.emptyTitle}>No workouts yet</Text>
            <Text style={styles.emptyBody}>
              Build a reusable workout (like &quot;Push Day&quot;) with your exercises, then start it
              in one tap.
            </Text>
            <AppButton
              label="Create a workout"
              icon="add"
              onPress={() => router.push('/template/edit')}
              style={{ marginTop: Spacing.four }}
            />
          </Card>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tplScroll}
            contentContainerStyle={styles.tplRow}>
            {templates.map((t) => {
              const setCount = t.exercises.reduce((n, e) => n + e.sets.length, 0);
              return (
                <Pressable key={t.id} style={styles.tplCard} onPress={() => startTemplate(t.id)}>
                  <View style={styles.tplTop}>
                    <View style={[styles.tplIcon, { backgroundColor: `${t.color}22` }]}>
                      <Ionicons
                        name={t.icon as keyof typeof Ionicons.glyphMap}
                        size={22}
                        color={t.color}
                      />
                    </View>
                    <Pressable
                      hitSlop={8}
                      onPress={() => router.push(`/template/edit?id=${t.id}`)}
                      style={styles.tplEdit}>
                      <Ionicons name="ellipsis-horizontal" size={18} color={palette.muted} />
                    </Pressable>
                  </View>
                  <Text style={styles.tplName} numberOfLines={1}>
                    {t.name}
                  </Text>
                  <Text style={styles.tplMeta}>
                    {t.exercises.length} exercise{t.exercises.length === 1 ? '' : 's'} · {setCount} set
                    {setCount === 1 ? '' : 's'}
                  </Text>
                  <View style={styles.tplStart}>
                    <Ionicons name="play" size={13} color={t.color} />
                    <Text style={[styles.tplStartText, { color: t.color }]}>Start</Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        <AppButton
          label="Start empty workout"
          icon="add"
          variant="secondary"
          onPress={startEmpty}
          style={{ marginTop: Spacing.three }}
        />

        {/* Recent */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Recent</Text>
          {sessions.length > 3 && (
            <Pressable onPress={() => router.push('/history')} hitSlop={8}>
              <Text style={styles.link}>See all</Text>
            </Pressable>
          )}
        </View>
        {recent.length === 0 ? (
          <Text style={styles.emptyBody}>No workouts yet. Start one above to see it here.</Text>
        ) : (
          recent.map((s) => {
            const st = sessionStats(s);
            return (
              <Pressable key={s.id} onPress={() => router.push(`/session/${s.id}`)}>
                <Card style={styles.recentCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recentName}>{s.name}</Text>
                    <Text style={styles.recentMeta}>
                      {formatDate(s.finishedAt ?? s.startedAt)} · {st.exercises} exercises · {st.sets}{' '}
                      sets
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={palette.muted} />
                </Card>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ResumeCard({ active, onPress }: { active: WorkoutSession; onPress: () => void }) {
  const c = active.color ?? palette.accent;
  const ic = (active.icon ?? 'barbell') as keyof typeof Ionicons.glyphMap;
  const paused = active.pausedAt != null;
  let total = 0;
  let done = 0;
  for (const ex of active.exercises) {
    for (const s of ex.sets) {
      total += 1;
      if (s.done) done += 1;
    }
  }

  return (
    <Pressable
      onPress={onPress}
      style={[styles.resumeCard, { borderColor: `${c}55`, backgroundColor: `${c}14` }]}>
      <View style={[styles.resumeIcon, { backgroundColor: `${c}22` }]}>
        <Ionicons name={ic} size={22} color={c} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.resumeStatusRow}>
          <View style={[styles.liveDot, { backgroundColor: paused ? palette.muted : c }]} />
          <Text style={[styles.resumeStatus, { color: paused ? palette.muted : c }]}>
            {paused ? 'Paused' : 'In progress'}
          </Text>
        </View>
        <Text style={styles.resumeName} numberOfLines={1}>
          {active.name}
        </Text>
        <Text style={styles.resumeMeta}>
          {done} of {total} set{total === 1 ? '' : 's'} done
        </Text>
      </View>
      <View style={[styles.resumeBtn, { backgroundColor: c }]}>
        <Ionicons name="play" size={15} color={palette.onAccent} />
        <Text style={styles.resumeBtnText}>Resume</Text>
      </View>
    </Pressable>
  );
}

function Stat({
  value,
  label,
  unit,
  accent,
}: {
  value: string;
  label: string;
  unit: string;
  accent?: boolean;
}) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, accent && { color: palette.accent }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statUnit}>{unit}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bg },
  content: { padding: Spacing.four, paddingBottom: Spacing.eight, gap: Spacing.four },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  logo: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: { color: palette.fg, fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },

  // --- Active takeover ---
  hero: {
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.five,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  liveLabel: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  timer: {
    color: palette.fg,
    fontSize: 52,
    fontWeight: '800',
    letterSpacing: -1,
    marginTop: Spacing.four,
    fontVariant: ['tabular-nums'],
  },
  heroName: { color: palette.fg, fontSize: 20, fontWeight: '700', marginTop: Spacing.one },
  progressTrack: {
    height: 8,
    borderRadius: Radius.full,
    backgroundColor: palette.surface2,
    overflow: 'hidden',
    marginTop: Spacing.four,
  },
  progressFill: { height: '100%', borderRadius: Radius.full },
  progressText: { color: palette.muted, fontSize: 13, fontWeight: '600', marginTop: Spacing.two },

  miniRow: { flexDirection: 'row', gap: Spacing.three },
  mini: {
    flex: 1,
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.three,
    alignItems: 'center',
    gap: 2,
  },
  miniValue: { color: palette.fg, fontSize: 20, fontWeight: '800' },
  miniLabel: { color: palette.muted, fontSize: 12 },

  pauseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.four,
    borderRadius: Radius.md,
  },
  pauseText: { fontSize: 16, fontWeight: '800' },

  exRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.three,
  },
  exCheck: {
    width: 34,
    height: 34,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: palette.border,
    backgroundColor: palette.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exCheckText: { color: palette.muted, fontSize: 12, fontWeight: '700' },
  exBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  exName: { color: palette.fg, fontSize: 15, fontWeight: '700' },
  exNameDone: { color: palette.muted, textDecorationLine: 'line-through' },
  exMeta: { color: palette.muted, fontSize: 12, marginTop: 1 },

  // --- Per-exercise editor ---
  editTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomColor: palette.border,
    borderBottomWidth: 1,
  },
  editTitle: { color: palette.fg, fontSize: 18, fontWeight: '800' },
  editSubtitle: { color: palette.muted, fontSize: 13, marginTop: 1 },
  editDone: { fontSize: 16, fontWeight: '800' },
  editContent: { padding: Spacing.four, paddingBottom: Spacing.eight },
  setHeadRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingBottom: Spacing.two },
  setHeadText: { color: palette.muted, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  colSet: { width: 36, textAlign: 'center' },
  colInput: { flex: 1 },
  colDone: { width: 44, alignItems: 'center' },
  editSetRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.one },
  setIndex: { color: palette.muted, fontSize: 15, fontWeight: '700' },
  setInput: {
    color: palette.fg,
    fontSize: 16,
    textAlign: 'center',
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.three,
  },
  checkWrap: { alignItems: 'center', justifyContent: 'center' },
  check: {
    width: 30,
    height: 30,
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSet: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    marginTop: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: Radius.sm,
    backgroundColor: palette.surface2,
  },
  addSetText: { color: palette.accent, fontSize: 14, fontWeight: '700' },
  editHint: { color: palette.muted, fontSize: 12, textAlign: 'center', marginTop: Spacing.three },
  markComplete: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    marginTop: Spacing.five,
    paddingVertical: Spacing.four,
    borderRadius: Radius.md,
    borderWidth: 1.5,
  },
  markCompleteText: { fontSize: 16, fontWeight: '800' },

  // --- Dashboard ---
  resumeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.three,
  },
  resumeIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resumeStatusRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one + 2 },
  resumeStatus: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  resumeName: { color: palette.fg, fontSize: 16, fontWeight: '800', marginTop: 2 },
  resumeMeta: { color: palette.muted, fontSize: 12, marginTop: 1 },
  resumeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.full,
  },
  resumeBtnText: { color: palette.onAccent, fontSize: 13, fontWeight: '800' },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  stat: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.three,
    gap: 2,
  },
  statValue: { color: palette.fg, fontSize: 24, fontWeight: '800' },
  statLabel: { color: palette.fg, fontSize: 13, fontWeight: '600' },
  statUnit: { color: palette.muted, fontSize: 12 },

  chartCard: { gap: Spacing.three },
  cardTitle: { color: palette.fg, fontSize: 15, fontWeight: '700' },
  chart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 96 },
  barCol: { flex: 1, alignItems: 'center', gap: Spacing.two },
  barTrack: {
    width: 14,
    height: 72,
    justifyContent: 'flex-end',
    borderRadius: Radius.full,
    overflow: 'hidden',
    backgroundColor: palette.surface2,
  },
  barFill: { width: '100%', borderRadius: Radius.full },
  barLabel: { color: palette.muted, fontSize: 11, fontWeight: '600' },

  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { color: palette.fg, fontSize: 18, fontWeight: '700' },
  link: { color: palette.accent, fontSize: 14, fontWeight: '700' },

  emptyTitle: { color: palette.fg, fontSize: 17, fontWeight: '700' },
  emptyBody: { color: palette.muted, fontSize: 14, lineHeight: 20, marginTop: Spacing.two },

  tplScroll: { flexGrow: 0, flexShrink: 0, marginHorizontal: -Spacing.four },
  tplRow: { paddingHorizontal: Spacing.four, gap: Spacing.three },
  tplCard: {
    width: 150,
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.three,
  },
  tplTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  tplIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tplEdit: { padding: 2 },
  tplName: { color: palette.fg, fontSize: 16, fontWeight: '700', marginTop: Spacing.three },
  tplMeta: { color: palette.muted, fontSize: 12, marginTop: 1 },
  tplStart: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: Spacing.three },
  tplStartText: { fontSize: 13, fontWeight: '800' },

  recentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  recentName: { color: palette.fg, fontSize: 16, fontWeight: '700' },
  recentMeta: { color: palette.muted, fontSize: 13, marginTop: 2 },
});
