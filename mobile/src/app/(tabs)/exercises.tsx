import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, EmptyState, Loading } from '@/components/ui';
import { palette, Radius, Spacing } from '@/constants/theme';
import { MUSCLE_GROUPS, type MuscleGroup } from '@/lib/types';
import { useWorkouts } from '@/store/workouts';

export default function ExercisesScreen() {
  const { loaded, exercises, addCustomExercise } = useWorkouts();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<MuscleGroup | 'All'>('All');
  const [adding, setAdding] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises
      .filter((e) => (filter === 'All' ? true : e.muscle === filter))
      .filter((e) => (q ? e.name.toLowerCase().includes(q) : true))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [exercises, query, filter]);

  if (!loaded) return <Loading />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Exercises</Text>
        <Pressable style={styles.addBtn} onPress={() => setAdding(true)}>
          <Ionicons name="add" size={20} color={palette.onAccent} />
        </Pressable>
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
        {query ? (
          <Pressable onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={18} color={palette.muted} />
          </Pressable>
        ) : null}
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
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon="search-outline"
            title="No exercises found"
            body="Try a different search or add a custom exercise with the + button."
          />
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Ionicons name="barbell-outline" size={18} color={palette.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowName}>{item.name}</Text>
              <Text style={styles.rowMuscle}>{item.muscle}</Text>
            </View>
            {item.isCustom ? <Text style={styles.customTag}>Custom</Text> : null}
          </View>
        )}
      />

      <AddExerciseModal
        visible={adding}
        onClose={() => setAdding(false)}
        onAdd={(name, muscle) => {
          addCustomExercise(name, muscle);
          setAdding(false);
        }}
      />
    </SafeAreaView>
  );
}

function AddExerciseModal({
  visible,
  onClose,
  onAdd,
}: {
  visible: boolean;
  onClose: () => void;
  onAdd: (name: string, muscle: MuscleGroup) => void;
}) {
  const [name, setName] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup>('Chest');

  const submit = () => {
    if (!name.trim()) return;
    onAdd(name, muscle);
    setName('');
    setMuscle('Chest');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New exercise</Text>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={24} color={palette.muted} />
            </Pressable>
          </View>

          <Text style={styles.label}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Hack Squat"
            placeholderTextColor={palette.muted}
            style={styles.input}
            autoFocus
          />

          <Text style={styles.label}>Muscle group</Text>
          <View style={styles.muscleGrid}>
            {MUSCLE_GROUPS.map((m) => (
              <Pressable
                key={m}
                onPress={() => setMuscle(m)}
                style={[styles.filterPill, muscle === m && styles.filterPillActive]}>
                <Text style={[styles.filterText, muscle === m && styles.filterTextActive]}>{m}</Text>
              </Pressable>
            ))}
          </View>

          <AppButton
            label="Add exercise"
            icon="add"
            onPress={submit}
            disabled={!name.trim()}
            style={{ marginTop: Spacing.five }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
  },
  title: { color: palette.fg, fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginHorizontal: Spacing.four,
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
  list: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.eight, gap: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.three,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    backgroundColor: palette.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowName: { color: palette.fg, fontSize: 16, fontWeight: '600' },
  rowMuscle: { color: palette.muted, fontSize: 13, marginTop: 1 },
  customTag: {
    color: palette.accent,
    fontSize: 12,
    fontWeight: '700',
    borderColor: palette.accent,
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },

  modalOverlay: { flex: 1, backgroundColor: '#000000aa', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: palette.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderColor: palette.border,
    borderWidth: 1,
    padding: Spacing.five,
    paddingBottom: Spacing.eight,
    gap: Spacing.two,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.two },
  modalTitle: { color: palette.fg, fontSize: 20, fontWeight: '800' },
  label: { color: palette.muted, fontSize: 13, fontWeight: '600', marginTop: Spacing.three, marginBottom: Spacing.one },
  input: {
    color: palette.fg,
    fontSize: 16,
    backgroundColor: palette.bg,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  muscleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
