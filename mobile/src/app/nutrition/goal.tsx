import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
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

import { AppButton } from '@/components/ui';
import { palette, Radius, Spacing } from '@/constants/theme';
import { computeGoal, weeksToGoal, type GoalInput } from '@/lib/nutrition';
import { ACTIVITY_LEVELS, SEXES, type ActivityKey, type Sex } from '@/lib/types';
import { useNutrition } from '@/store/nutrition';

const RATES = [0.5, 1, 1.5, 2];

export default function GoalScreen() {
  const router = useRouter();
  const { goal, setGoal } = useNutrition();

  const [sex, setSex] = useState<Sex>(goal?.sex ?? 'male');
  const [age, setAge] = useState(goal ? String(goal.age) : '');
  const [feet, setFeet] = useState(goal ? String(Math.floor(goal.heightIn / 12)) : '');
  const [inches, setInches] = useState(goal ? String(goal.heightIn % 12) : '');
  const [current, setCurrent] = useState(goal ? String(goal.currentWeightLb) : '');
  const [targetW, setTargetW] = useState(goal ? String(goal.targetWeightLb) : '');
  const [activity, setActivity] = useState<ActivityKey>(goal?.activity ?? 'moderate');
  const [rate, setRate] = useState(goal?.weeklyRateLb ?? 1);

  const num = (s: string) => {
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  };

  const input: GoalInput | null = useMemo(() => {
    const heightIn = num(feet) * 12 + num(inches);
    const a = num(age);
    const cw = num(current);
    const tw = num(targetW);
    if (a < 13 || a > 100 || heightIn < 36 || cw < 50 || tw < 50) return null;
    return { sex, age: a, heightIn, currentWeightLb: cw, targetWeightLb: tw, activity, weeklyRateLb: rate };
  }, [sex, age, feet, inches, current, targetW, activity, rate]);

  const preview = input ? computeGoal(input) : null;
  const weeks = input ? weeksToGoal(input) : null;

  const onSave = () => {
    if (!input) return;
    setGoal(input);
    router.back();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.side}>
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
        <Text style={styles.topTitle}>Your goal</Text>
        <Pressable onPress={onSave} hitSlop={10} disabled={!input} style={styles.side}>
          <Text style={[styles.save, !input && styles.saveDisabled]}>Save</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Sex</Text>
          <View style={styles.row}>
            {SEXES.map((s) => (
              <Pressable
                key={s}
                onPress={() => setSex(s)}
                style={[styles.segment, sex === s && styles.segmentOn]}>
                <Text style={[styles.segmentText, sex === s && styles.segmentTextOn]}>
                  {s === 'male' ? 'Male' : 'Female'}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.grid}>
            <Field label="Age" value={age} onChange={setAge} suffix="yrs" />
            <View style={styles.heightWrap}>
              <Text style={styles.label}>Height</Text>
              <View style={styles.heightRow}>
                <TextInput style={[styles.input, styles.heightInput]} keyboardType="numeric" placeholder="5" placeholderTextColor={palette.muted} value={feet} onChangeText={setFeet} />
                <Text style={styles.heightUnit}>ft</Text>
                <TextInput style={[styles.input, styles.heightInput]} keyboardType="numeric" placeholder="10" placeholderTextColor={palette.muted} value={inches} onChangeText={setInches} />
                <Text style={styles.heightUnit}>in</Text>
              </View>
            </View>
          </View>

          <View style={styles.grid}>
            <Field label="Current weight" value={current} onChange={setCurrent} suffix="lb" />
            <Field label="Target weight" value={targetW} onChange={setTargetW} suffix="lb" />
          </View>

          <Text style={styles.label}>Activity level</Text>
          <View style={styles.pillWrap}>
            {ACTIVITY_LEVELS.map((a) => (
              <Pressable
                key={a.key}
                onPress={() => setActivity(a.key)}
                style={[styles.pill, activity === a.key && styles.pillOn]}>
                <Text style={[styles.pillText, activity === a.key && styles.pillTextOn]}>{a.label}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.activityDesc}>
            {ACTIVITY_LEVELS.find((a) => a.key === activity)?.desc}
          </Text>

          <Text style={styles.label}>Weekly pace</Text>
          <View style={styles.pillWrap}>
            {RATES.map((r) => (
              <Pressable
                key={r}
                onPress={() => setRate(r)}
                style={[styles.pill, rate === r && styles.pillOn]}>
                <Text style={[styles.pillText, rate === r && styles.pillTextOn]}>{r} lb/wk</Text>
              </Pressable>
            ))}
          </View>

          {preview ? (
            <View style={styles.previewCard}>
              <View style={styles.previewIcon}>
                <Ionicons name="sparkles" size={18} color={palette.onAccent} />
              </View>
              <Text style={styles.previewLabel}>Your daily target</Text>
              <Text style={styles.previewValue}>
                {preview.targetCalories}
                <Text style={styles.previewUnit}> kcal / day</Text>
              </Text>
              <Text style={styles.previewSub}>
                Maintenance ≈ {preview.maintenanceCalories} kcal · P{preview.proteinTargetG} C
                {preview.carbsTargetG} F{preview.fatTargetG}
                {weeks ? ` · ~${weeks} weeks to goal` : ''}
              </Text>
            </View>
          ) : (
            <Text style={styles.hint}>Fill in your stats to see your calculated calorie target.</Text>
          )}

          <AppButton
            label={goal ? 'Update goal' : 'Set goal'}
            icon="checkmark"
            onPress={onSave}
            disabled={!input}
            style={{ marginTop: Spacing.five }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  suffix: string;
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={palette.muted}
          value={value}
          onChangeText={onChange}
        />
        <Text style={styles.suffix}>{suffix}</Text>
      </View>
    </View>
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
  label: { color: palette.muted, fontSize: 13, fontWeight: '700', marginTop: Spacing.four, marginBottom: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.two },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  segmentOn: { backgroundColor: palette.accent, borderColor: palette.accent },
  segmentText: { color: palette.fg, fontSize: 15, fontWeight: '600' },
  segmentTextOn: { color: palette.onAccent },

  grid: { flexDirection: 'row', gap: Spacing.three },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
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
  suffix: { color: palette.muted, fontSize: 14 },
  heightWrap: { flex: 1 },
  heightRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  heightInput: { width: 52, textAlign: 'center' },
  heightUnit: { color: palette.muted, fontSize: 14 },

  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  pill: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  pillOn: { backgroundColor: palette.accent, borderColor: palette.accent },
  pillText: { color: palette.muted, fontSize: 14, fontWeight: '600' },
  pillTextOn: { color: palette.onAccent },
  activityDesc: { color: palette.muted, fontSize: 13, marginTop: Spacing.two },

  previewCard: {
    marginTop: Spacing.five,
    backgroundColor: palette.surface,
    borderColor: palette.accent,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.four,
    alignItems: 'center',
  },
  previewIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  previewLabel: { color: palette.muted, fontSize: 13, fontWeight: '600' },
  previewValue: { color: palette.fg, fontSize: 34, fontWeight: '800', letterSpacing: -0.5, marginTop: Spacing.one },
  previewUnit: { fontSize: 16, fontWeight: '600', color: palette.muted },
  previewSub: { color: palette.muted, fontSize: 13, textAlign: 'center', marginTop: Spacing.two, lineHeight: 18 },
  hint: { color: palette.muted, fontSize: 14, marginTop: Spacing.five, textAlign: 'center' },
});
