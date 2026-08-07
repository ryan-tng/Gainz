import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
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
import { useNutrition } from '@/store/nutrition';
import { useTheme, useThemedStyles } from '@/store/theme';

const numOrNull = (t: string): number | null => {
  const cleaned = t.replace(/[^0-9.]/g, '');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

/** Prefill helper: show a rounded number, or blank for zero/missing. */
const s = (n: number | undefined) => (n ? String(Math.round(n)) : '');

export default function AddFoodScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { addEntry, updateEntry, deleteEntry, getEntry } = useNutrition();
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const existing = id ? getEntry(id) : undefined;

  const [label, setLabel] = useState(existing?.label ?? '');
  const [calories, setCalories] = useState(existing ? String(existing.calories) : '');
  const [protein, setProtein] = useState(s(existing?.protein_g));
  const [carbs, setCarbs] = useState(s(existing?.carbs_g));
  const [fat, setFat] = useState(s(existing?.fat_g));

  const cals = numOrNull(calories);
  const canSave = label.trim().length > 0 && cals !== null && cals >= 0;

  const save = () => {
    if (!canSave) return;
    const data = {
      label: label.trim(),
      calories: Math.round(cals),
      protein_g: numOrNull(protein) ?? 0,
      carbs_g: numOrNull(carbs) ?? 0,
      fat_g: numOrNull(fat) ?? 0,
    };
    if (existing) updateEntry(existing.id, data);
    else addEntry(data);
    router.back();
  };

  const onDelete = () => {
    if (!existing) return;
    Alert.alert('Delete entry?', `Remove "${existing.label}" from your log?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteEntry(existing.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: 'transparent' }]} edges={['top', 'bottom']}>
      <AppBackground />
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={16} style={styles.side}>
          <Ionicons name="close" size={26} color={palette.fg} />
        </Pressable>
        <Text style={styles.topTitle}>{existing ? 'Edit entry' : 'Add manually'}</Text>
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
          <Text style={styles.label}>What did you eat?</Text>
          <TextInput
            style={styles.input}
            value={label}
            onChangeText={setLabel}
            placeholder="e.g. Chicken & rice"
            placeholderTextColor={palette.muted}
            autoFocus={!existing}
          />

          <Text style={styles.label}>Calories</Text>
          <TextInput
            style={[styles.input, styles.calInput]}
            value={calories}
            onChangeText={setCalories}
            placeholder="0"
            placeholderTextColor={palette.muted}
            keyboardType="numeric"
          />

          <Text style={styles.label}>Macros (optional)</Text>
          <View style={styles.macroRow}>
            <MacroField label="Protein" unit="g" value={protein} onChange={setProtein} />
            <MacroField label="Carbs" unit="g" value={carbs} onChange={setCarbs} />
            <MacroField label="Fat" unit="g" value={fat} onChange={setFat} />
          </View>

          <Text style={styles.hint}>
            Only a name and calories are required. Add macros if you know them for more accurate
            tracking.
          </Text>

          <AppButton
            label={existing ? 'Save changes' : "Add to today's log"}
            icon="checkmark"
            onPress={save}
            disabled={!canSave}
            style={{ marginTop: Spacing.five }}
          />
          {existing ? (
            <AppButton
              label="Delete entry"
              icon="trash-outline"
              variant="danger"
              onPress={onDelete}
              style={{ marginTop: Spacing.three }}
            />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MacroField({
  label,
  unit,
  value,
  onChange,
}: {
  label: string;
  unit: string;
  value: string;
  onChange: (t: string) => void;
}) {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.macroField}>
      <Text style={styles.macroLabel}>{label}</Text>
      <View style={styles.macroInputWrap}>
        <TextInput
          style={styles.macroInput}
          value={value}
          onChangeText={onChange}
          placeholder="0"
          placeholderTextColor={palette.muted}
          keyboardType="numeric"
        />
        <Text style={styles.macroUnit}>{unit}</Text>
      </View>
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
  side: { minWidth: 60 },
  topTitle: { color: palette.fg, fontSize: 17, fontWeight: '700' },
  save: { color: palette.accent, fontSize: 16, fontWeight: '800', textAlign: 'right' },
  saveDisabled: { color: palette.muted },

  content: { padding: Spacing.four, paddingBottom: Spacing.eight },
  label: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: '700',
    marginTop: Spacing.four,
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
  calInput: { fontSize: 22, fontWeight: '800' },

  macroRow: { flexDirection: 'row', gap: Spacing.three },
  macroField: { flex: 1 },
  macroLabel: { color: palette.muted, fontSize: 12, marginBottom: Spacing.one },
  macroInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
  },
  macroInput: { flex: 1, color: palette.fg, fontSize: 16, fontWeight: '700', paddingVertical: Spacing.three },
  macroUnit: { color: palette.muted, fontSize: 13 },

  hint: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: Spacing.three },
});
