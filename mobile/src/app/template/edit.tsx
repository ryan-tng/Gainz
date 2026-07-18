import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/ui';
import { palette, Radius, Spacing } from '@/constants/theme';
import { TEMPLATE_COLORS, TEMPLATE_ICONS } from '@/lib/templates';
import type { Exercise, TemplateExercise, TemplateSet } from '@/lib/types';
import { useWorkouts } from '@/store/workouts';

const numOrNull = (t: string): number | null => {
  const cleaned = t.replace(/[^0-9.]/g, '');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

export default function TemplateEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { exercises, getTemplate, addTemplate, updateTemplate, deleteTemplate, getLastPerformance } =
    useWorkouts();
  const existing = id ? getTemplate(id) : undefined;

  const [name, setName] = useState(existing?.name ?? '');
  const [icon, setIcon] = useState<string>(existing?.icon ?? TEMPLATE_ICONS[0]);
  const [color, setColor] = useState<string>(existing?.color ?? TEMPLATE_COLORS[0]);
  const [items, setItems] = useState<TemplateExercise[]>(existing?.exercises ?? []);
  const [picking, setPicking] = useState(false);

  const canSave = name.trim().length > 0 && items.length > 0;

  const addSetTo = (exerciseId: string) =>
    setItems((cur) =>
      cur.map((it) =>
        it.exerciseId === exerciseId && it.sets.length < 12
          ? {
              ...it,
              // Copy the last set so you can tweak just what changed.
              sets: [...it.sets, { ...(it.sets[it.sets.length - 1] ?? { weight: null, reps: null }) }],
            }
          : it,
      ),
    );

  const removeSetFrom = (exerciseId: string, index: number) =>
    setItems((cur) =>
      cur.map((it) =>
        it.exerciseId === exerciseId && it.sets.length > 1
          ? { ...it, sets: it.sets.filter((_, i) => i !== index) }
          : it,
      ),
    );

  const updateSetOf = (exerciseId: string, index: number, patch: Partial<TemplateSet>) =>
    setItems((cur) =>
      cur.map((it) =>
        it.exerciseId === exerciseId
          ? { ...it, sets: it.sets.map((s, i) => (i === index ? { ...s, ...patch } : s)) }
          : it,
      ),
    );

  const addExercises = (picked: Exercise[]) => {
    setItems((cur) => {
      const have = new Set(cur.map((i) => i.exerciseId));
      const additions = picked
        .filter((e) => !have.has(e.id))
        .map<TemplateExercise>((e) => ({
          exerciseId: e.id,
          name: e.name,
          muscle: e.muscle,
          // Prefill from the last time you did this exercise, if we have it.
          sets:
            getLastPerformance(e.id) ??
            [
              { weight: null, reps: null },
              { weight: null, reps: null },
              { weight: null, reps: null },
            ],
        }));
      return [...cur, ...additions];
    });
    setPicking(false);
  };

  const onSave = () => {
    if (!canSave) return;
    const input = { name: name.trim(), icon, color, exercises: items };
    if (existing) updateTemplate(existing.id, input);
    else addTemplate(input);
    router.back();
  };

  const onDelete = () => {
    if (!existing) return;
    Alert.alert('Delete workout?', `Remove "${existing.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteTemplate(existing.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.side}>
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
        <Text style={styles.topTitle}>{existing ? 'Edit workout' : 'New workout'}</Text>
        <Pressable onPress={onSave} hitSlop={10} disabled={!canSave} style={styles.side}>
          <Text style={[styles.save, !canSave && styles.saveDisabled]}>Save</Text>
        </Pressable>
      </View>

      <FlatList
        data={items}
        keyExtractor={(it) => it.exerciseId}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View>
            {/* Preview + name */}
            <View style={styles.previewRow}>
              <View style={[styles.previewIcon, { backgroundColor: `${color}22` }]}>
                <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={28} color={color} />
              </View>
              <TextInput
                style={styles.nameInput}
                value={name}
                onChangeText={setName}
                placeholder="Workout name"
                placeholderTextColor={palette.muted}
              />
            </View>

            <Text style={styles.label}>Icon</Text>
            <View style={styles.iconRow}>
              {TEMPLATE_ICONS.map((ic) => (
                <Pressable
                  key={ic}
                  onPress={() => setIcon(ic)}
                  style={[styles.iconChip, icon === ic && { borderColor: color }]}>
                  <Ionicons
                    name={ic as keyof typeof Ionicons.glyphMap}
                    size={20}
                    color={icon === ic ? color : palette.muted}
                  />
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Color</Text>
            <View style={styles.colorRow}>
              {TEMPLATE_COLORS.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setColor(c)}
                  style={[
                    styles.colorDot,
                    { backgroundColor: c },
                    color === c && styles.colorDotOn,
                  ]}>
                  {color === c ? <Ionicons name="checkmark" size={16} color={palette.onAccent} /> : null}
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Exercises</Text>
            {items.length === 0 ? (
              <Text style={styles.emptyText}>No exercises yet. Add some below.</Text>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.exCard}>
            <View style={styles.exCardHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.exName}>{item.name}</Text>
                <Text style={styles.exMuscle}>{item.muscle}</Text>
              </View>
              <Pressable
                onPress={() => setItems((cur) => cur.filter((i) => i.exerciseId !== item.exerciseId))}
                hitSlop={8}>
                <Ionicons name="close-circle" size={22} color={palette.muted} />
              </Pressable>
            </View>

            <View style={styles.setHeadRow}>
              <Text style={[styles.setHeadText, styles.colSet]}>Set</Text>
              <Text style={[styles.setHeadText, styles.colInput]}>lb</Text>
              <Text style={[styles.setHeadText, styles.colInput]}>Reps</Text>
              <View style={styles.colDel} />
            </View>

            {item.sets.map((s, i) => (
              <View key={i} style={styles.setRow}>
                <Text style={[styles.setIndex, styles.colSet]}>{i + 1}</Text>
                <TextInput
                  style={[styles.setInput, styles.colInput]}
                  keyboardType="numeric"
                  placeholder="—"
                  placeholderTextColor={palette.muted}
                  value={s.weight === null ? '' : String(s.weight)}
                  onChangeText={(t) => updateSetOf(item.exerciseId, i, { weight: numOrNull(t) })}
                />
                <TextInput
                  style={[styles.setInput, styles.colInput]}
                  keyboardType="numeric"
                  placeholder="—"
                  placeholderTextColor={palette.muted}
                  value={s.reps === null ? '' : String(s.reps)}
                  onChangeText={(t) => updateSetOf(item.exerciseId, i, { reps: numOrNull(t) })}
                />
                <Pressable
                  onPress={() => removeSetFrom(item.exerciseId, i)}
                  hitSlop={6}
                  disabled={item.sets.length <= 1}
                  style={styles.colDel}>
                  <Ionicons
                    name="remove-circle-outline"
                    size={20}
                    color={item.sets.length <= 1 ? palette.border : palette.muted}
                  />
                </Pressable>
              </View>
            ))}

            <Pressable style={styles.addSet} onPress={() => addSetTo(item.exerciseId)}>
              <Ionicons name="add" size={16} color={palette.accent} />
              <Text style={styles.addSetText}>Add set</Text>
            </Pressable>
          </View>
        )}
        ListFooterComponent={
          <View>
            <Text style={styles.setsHint}>
              Fill in the weight × reps you usually do — they&apos;ll be prefilled when you start,
              and update automatically after each workout.
            </Text>
            <AppButton
              label="Add exercises"
              icon="add"
              variant="secondary"
              onPress={() => setPicking(true)}
              style={{ marginTop: Spacing.three }}
            />
            {existing ? (
              <AppButton
                label="Delete workout"
                icon="trash-outline"
                variant="danger"
                onPress={onDelete}
                style={{ marginTop: Spacing.three }}
              />
            ) : null}
          </View>
        }
      />

      <ExercisePicker
        visible={picking}
        exercises={exercises}
        disabledIds={new Set(items.map((i) => i.exerciseId))}
        onClose={() => setPicking(false)}
        onConfirm={addExercises}
      />
    </SafeAreaView>
  );
}

function ExercisePicker({
  visible,
  exercises,
  disabledIds,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  exercises: Exercise[];
  disabledIds: Set<string>;
  onClose: () => void;
  onConfirm: (picked: Exercise[]) => void;
}) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises
      .filter((e) => (q ? e.name.toLowerCase().includes(q) : true))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [exercises, query]);

  const toggle = (id: string) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const confirm = () => {
    onConfirm(exercises.filter((e) => selected.has(e.id)));
    setSelected(new Set());
    setQuery('');
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaProvider>
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Pressable onPress={onClose} hitSlop={16} style={styles.side}>
            <Ionicons name="close" size={26} color={palette.fg} />
          </Pressable>
          <Text style={styles.topTitle}>Add exercises</Text>
          <View style={styles.side} />
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

        <FlatList
          data={filtered}
          keyExtractor={(e) => e.id}
          contentContainerStyle={styles.pickList}
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
                  <Text style={styles.exName}>{item.name}</Text>
                  <Text style={styles.exMuscle}>{item.muscle}</Text>
                </View>
                {already ? (
                  <Text style={styles.addedTag}>Added</Text>
                ) : (
                  <View style={[styles.selCircle, isSel && styles.selCircleOn]}>
                    {isSel ? <Ionicons name="checkmark" size={16} color={palette.onAccent} /> : null}
                  </View>
                )}
              </Pressable>
            );
          }}
        />

        <View style={styles.pickerFooter}>
          <AppButton
            label={selected.size ? `Add ${selected.size}` : 'Select exercises'}
            icon="add"
            onPress={confirm}
            disabled={selected.size === 0}
          />
        </View>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  cancel: { color: palette.muted, fontSize: 16 },
  save: { color: palette.accent, fontSize: 16, fontWeight: '800', textAlign: 'right' },
  saveDisabled: { color: palette.muted },

  content: { padding: Spacing.four, paddingBottom: Spacing.eight },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  previewIcon: { width: 56, height: 56, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center' },
  nameInput: {
    flex: 1,
    color: palette.fg,
    fontSize: 20,
    fontWeight: '700',
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  label: { color: palette.muted, fontSize: 13, fontWeight: '700', marginTop: Spacing.four, marginBottom: Spacing.two },
  iconRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  iconChip: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  colorDot: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorDotOn: { borderColor: palette.fg },
  emptyText: { color: palette.muted, fontSize: 14 },

  exCard: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.three,
    marginBottom: Spacing.three,
  },
  exCardHead: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.two },
  exName: { color: palette.fg, fontSize: 15, fontWeight: '700' },
  exMuscle: { color: palette.muted, fontSize: 12, marginTop: 1 },

  setHeadRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingBottom: Spacing.one },
  setHeadText: { color: palette.muted, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  colSet: { width: 32, textAlign: 'center' },
  colInput: { flex: 1 },
  colDel: { width: 32, alignItems: 'center', justifyContent: 'center' },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.one },
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
  },
  addSet: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    marginTop: Spacing.two,
    paddingVertical: Spacing.two,
    borderRadius: Radius.sm,
    backgroundColor: palette.surface2,
  },
  addSetText: { color: palette.accent, fontSize: 14, fontWeight: '700' },
  setsHint: { color: palette.muted, fontSize: 12, marginTop: Spacing.one, lineHeight: 18 },

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
  pickList: { padding: Spacing.four, gap: Spacing.two },
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
  pickerFooter: { padding: Spacing.four, borderTopColor: palette.border, borderTopWidth: 1 },
});
