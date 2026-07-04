import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
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

import { AppButton, EmptyState } from '@/components/ui';
import { palette, Radius, Spacing } from '@/constants/theme';
import { MUSCLE_GROUPS, type MuscleGroup, type SetEntry, type WorkoutExercise } from '@/lib/types';
import { useWorkouts } from '@/store/workouts';

export default function ActiveWorkoutScreen() {
  const router = useRouter();
  const {
    active,
    exercises,
    addExercisesToActive,
    removeWorkoutExercise,
    addSet,
    updateSet,
    removeSet,
    finishWorkout,
    cancelWorkout,
    startWorkout,
  } = useWorkouts();
  const [picking, setPicking] = useState(false);

  // Safety net: if navigated here with no active session, start one.
  if (!active) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <EmptyState
            icon="barbell-outline"
            title="No active workout"
            body="Start a fresh workout to begin logging your sets."
          />
          <AppButton label="Start workout" icon="add" onPress={() => startWorkout()} />
        </View>
      </SafeAreaView>
    );
  }

  const alreadyAdded = new Set(active.exercises.map((we) => we.exerciseId));

  const onFinish = () => {
    if (active.exercises.length === 0) {
      onDiscard();
      return;
    }
    const id = finishWorkout();
    if (id) router.replace(`/session/${id}`);
    else router.back();
  };

  const onDiscard = () => {
    Alert.alert('Discard workout?', 'This workout will not be saved.', [
      { text: 'Keep going', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          cancelWorkout();
          router.back();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Pressable onPress={onDiscard} hitSlop={10} style={styles.topBtn}>
          <Ionicons name="close" size={22} color={palette.muted} />
        </Pressable>
        <Text style={styles.topTitle} numberOfLines={1}>
          {active.name}
        </Text>
        <Pressable onPress={onFinish} hitSlop={10} style={styles.finishBtn}>
          <Text style={styles.finishText}>Finish</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={8}>
        <FlatList
          data={active.exercises}
          keyExtractor={(we) => we.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              icon="add-circle-outline"
              title="Add your first exercise"
              body="Tap the button below to pick exercises for this workout."
            />
          }
          renderItem={({ item }) => (
            <ExerciseCard
              we={item}
              onAddSet={() => addSet(item.id)}
              onRemove={() => removeWorkoutExercise(item.id)}
              onUpdateSet={(setId, patch) => updateSet(item.id, setId, patch)}
              onRemoveSet={(setId) => removeSet(item.id, setId)}
            />
          )}
          ListFooterComponent={
            <AppButton
              label="Add exercise"
              icon="add"
              variant="secondary"
              onPress={() => setPicking(true)}
              style={{ marginTop: Spacing.three }}
            />
          }
        />
      </KeyboardAvoidingView>

      <ExercisePickerModal
        visible={picking}
        exercises={exercises}
        disabledIds={alreadyAdded}
        onClose={() => setPicking(false)}
        onConfirm={(ids) => {
          addExercisesToActive(ids);
          setPicking(false);
        }}
      />
    </SafeAreaView>
  );
}

function ExerciseCard({
  we,
  onAddSet,
  onRemove,
  onUpdateSet,
  onRemoveSet,
}: {
  we: WorkoutExercise;
  onAddSet: () => void;
  onRemove: () => void;
  onUpdateSet: (setId: string, patch: Partial<Pick<SetEntry, 'weight' | 'reps' | 'done'>>) => void;
  onRemoveSet: (setId: string) => void;
}) {
  return (
    <View style={styles.exCard}>
      <View style={styles.exHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.exName}>{we.name}</Text>
          <Text style={styles.exMuscle}>{we.muscle}</Text>
        </View>
        <Pressable onPress={onRemove} hitSlop={8}>
          <Ionicons name="trash-outline" size={18} color={palette.muted} />
        </Pressable>
      </View>

      <View style={styles.setHeaderRow}>
        <Text style={[styles.setHeaderText, styles.colSet]}>Set</Text>
        <Text style={[styles.setHeaderText, styles.colInput]}>lb</Text>
        <Text style={[styles.setHeaderText, styles.colInput]}>Reps</Text>
        <Text style={[styles.setHeaderText, styles.colDone]}>✓</Text>
      </View>

      {we.sets.map((s, i) => (
        <SetRow
          key={s.id}
          index={i + 1}
          set={s}
          onChange={(patch) => onUpdateSet(s.id, patch)}
          onRemove={() => onRemoveSet(s.id)}
        />
      ))}

      <Pressable style={styles.addSet} onPress={onAddSet}>
        <Ionicons name="add" size={16} color={palette.accent} />
        <Text style={styles.addSetText}>Add set</Text>
      </Pressable>
    </View>
  );
}

function SetRow({
  index,
  set,
  onChange,
  onRemove,
}: {
  index: number;
  set: SetEntry;
  onChange: (patch: Partial<Pick<SetEntry, 'weight' | 'reps' | 'done'>>) => void;
  onRemove: () => void;
}) {
  const numOrNull = (t: string) => {
    const cleaned = t.replace(/[^0-9.]/g, '');
    if (cleaned === '') return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  };

  return (
    <View style={[styles.setRow, set.done && styles.setRowDone]}>
      <Text style={[styles.setIndex, styles.colSet]}>{index}</Text>
      <TextInput
        style={[styles.setInput, styles.colInput]}
        keyboardType="numeric"
        placeholder="—"
        placeholderTextColor={palette.muted}
        value={set.weight === null ? '' : String(set.weight)}
        onChangeText={(t) => onChange({ weight: numOrNull(t) })}
      />
      <TextInput
        style={[styles.setInput, styles.colInput]}
        keyboardType="numeric"
        placeholder="—"
        placeholderTextColor={palette.muted}
        value={set.reps === null ? '' : String(set.reps)}
        onChangeText={(t) => onChange({ reps: numOrNull(t) })}
      />
      <Pressable
        style={[styles.colDone, styles.checkWrap]}
        onPress={() => onChange({ done: !set.done })}
        onLongPress={onRemove}>
        <View style={[styles.check, set.done && styles.checkDone]}>
          {set.done && <Ionicons name="checkmark" size={16} color={palette.onAccent} />}
        </View>
      </Pressable>
    </View>
  );
}

function ExercisePickerModal({
  visible,
  exercises,
  disabledIds,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  exercises: { id: string; name: string; muscle: MuscleGroup }[];
  disabledIds: Set<string>;
  onClose: () => void;
  onConfirm: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<MuscleGroup | 'All'>('All');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises
      .filter((e) => (filter === 'All' ? true : e.muscle === filter))
      .filter((e) => (q ? e.name.toLowerCase().includes(q) : true))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [exercises, query, filter]);

  const toggle = (id: string) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const confirm = () => {
    onConfirm([...selected]);
    setSelected(new Set());
    setQuery('');
    setFilter('All');
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Pressable onPress={onClose} hitSlop={10} style={styles.topBtn}>
            <Ionicons name="close" size={22} color={palette.muted} />
          </Pressable>
          <Text style={styles.topTitle}>Add exercises</Text>
          <View style={styles.topBtn} />
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={palette.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search exercises"
            placeholderTextColor={palette.muted}
            style={styles.search}
            autoCorrect={false}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}>
          {(['All', ...MUSCLE_GROUPS] as const).map((m) => (
            <Pressable
              key={m}
              onPress={() => setFilter(m)}
              style={[styles.filterPill, filter === m && styles.filterPillActive]}>
              <Text style={[styles.filterText, filter === m && styles.filterTextActive]}>{m}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <FlatList
          data={filtered}
          keyExtractor={(e) => e.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const already = disabledIds.has(item.id);
            const isSel = selected.has(item.id);
            return (
              <Pressable
                disabled={already}
                onPress={() => toggle(item.id)}
                style={[styles.pickRow, isSel && styles.pickRowSel, already && { opacity: 0.4 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName}>{item.name}</Text>
                  <Text style={styles.rowMuscle}>{item.muscle}</Text>
                </View>
                {already ? (
                  <Text style={styles.addedTag}>Added</Text>
                ) : (
                  <View style={[styles.selCircle, isSel && styles.selCircleOn]}>
                    {isSel && <Ionicons name="checkmark" size={16} color={palette.onAccent} />}
                  </View>
                )}
              </Pressable>
            );
          }}
        />

        <View style={styles.pickerFooter}>
          <AppButton
            label={selected.size ? `Add ${selected.size} exercise${selected.size === 1 ? '' : 's'}` : 'Select exercises'}
            icon="add"
            onPress={confirm}
            disabled={selected.size === 0}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bg },
  centered: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.four, gap: Spacing.three },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomColor: palette.border,
    borderBottomWidth: 1,
  },
  topBtn: { width: 60 },
  topTitle: { flex: 1, textAlign: 'center', color: palette.fg, fontSize: 17, fontWeight: '700' },
  finishBtn: {
    width: 60,
    alignItems: 'flex-end',
  },
  finishText: { color: palette.accent, fontSize: 16, fontWeight: '800' },

  list: { padding: Spacing.four, paddingBottom: Spacing.eight, gap: Spacing.three },

  exCard: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.four,
  },
  exHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.three },
  exName: { color: palette.fg, fontSize: 17, fontWeight: '700' },
  exMuscle: { color: palette.muted, fontSize: 13, marginTop: 1 },

  setHeaderRow: { flexDirection: 'row', alignItems: 'center', paddingBottom: Spacing.two },
  setHeaderText: { color: palette.muted, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  colSet: { width: 36, textAlign: 'center' },
  colInput: { flex: 1 },
  colDone: { width: 44, alignItems: 'center' },

  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  setRowDone: { opacity: 1 },
  setIndex: { color: palette.muted, fontSize: 15, fontWeight: '700' },
  setInput: {
    color: palette.fg,
    fontSize: 16,
    textAlign: 'center',
    backgroundColor: palette.bg,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.two,
    marginHorizontal: Spacing.one,
  },
  checkWrap: { alignItems: 'center', justifyContent: 'center' },
  check: {
    width: 28,
    height: 28,
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkDone: { backgroundColor: palette.accent, borderColor: palette.accent },

  addSet: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    marginTop: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.sm,
    backgroundColor: palette.surface2,
  },
  addSetText: { color: palette.accent, fontSize: 14, fontWeight: '700' },

  // Picker
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginHorizontal: Spacing.four,
    marginTop: Spacing.three,
    paddingHorizontal: Spacing.three,
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  search: { flex: 1, color: palette.fg, fontSize: 16, paddingVertical: Spacing.three },
  filters: { paddingHorizontal: Spacing.four, paddingVertical: Spacing.three, gap: Spacing.two },
  filterPill: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  filterPillActive: { backgroundColor: palette.accent, borderColor: palette.accent },
  filterText: { color: palette.muted, fontSize: 14, fontWeight: '600' },
  filterTextActive: { color: palette.onAccent },

  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.three,
  },
  pickRowSel: { borderColor: palette.accent },
  rowName: { color: palette.fg, fontSize: 16, fontWeight: '600' },
  rowMuscle: { color: palette.muted, fontSize: 13, marginTop: 1 },
  selCircle: {
    width: 26,
    height: 26,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selCircleOn: { backgroundColor: palette.accent, borderColor: palette.accent },
  addedTag: { color: palette.muted, fontSize: 13, fontWeight: '600' },
  pickerFooter: {
    padding: Spacing.four,
    borderTopColor: palette.border,
    borderTopWidth: 1,
  },
});
