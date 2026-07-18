import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/ui';
import { palette, Radius, Spacing } from '@/constants/theme';
import { MUSCLE_GROUPS, type MuscleGroup } from '@/lib/types';

/** Full-screen modal for picking one or more exercises to add to a workout/template. */
export function ExercisePickerModal({
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
      <SafeAreaProvider>
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Pressable onPress={onClose} hitSlop={16} style={styles.topBtn}>
            <Ionicons name="close" size={26} color={palette.fg} />
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
          style={styles.filterBar}
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
            label={
              selected.size
                ? `Add ${selected.size} exercise${selected.size === 1 ? '' : 's'}`
                : 'Select exercises'
            }
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
  topBtn: { width: 60 },
  topTitle: { flex: 1, textAlign: 'center', color: palette.fg, fontSize: 17, fontWeight: '700' },
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
  filterBar: { flexGrow: 0, flexShrink: 0 },
  filters: { paddingHorizontal: Spacing.four, paddingVertical: Spacing.three, gap: Spacing.two, alignItems: 'center' },
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
  list: { padding: Spacing.four, paddingBottom: Spacing.eight, gap: Spacing.two },
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
  pickerFooter: { padding: Spacing.four, borderTopColor: palette.border, borderTopWidth: 1 },
});
