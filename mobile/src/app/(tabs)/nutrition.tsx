import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, Card, Loading } from '@/components/ui';
import { palette, Radius, Spacing } from '@/constants/theme';
import { endOfDay, formatTime, startOfDay } from '@/lib/format';
import { useNutrition } from '@/store/nutrition';

export default function NutritionScreen() {
  const router = useRouter();
  const { loaded, goal, entriesForDay, deleteEntry } = useNutrition();

  if (!loaded) return <Loading />;

  const today = entriesForDay(startOfDay(), endOfDay());
  const consumed = today.reduce((s, e) => s + e.calories, 0);
  const protein = today.reduce((s, e) => s + e.protein_g, 0);
  const carbs = today.reduce((s, e) => s + e.carbs_g, 0);
  const fat = today.reduce((s, e) => s + e.fat_g, 0);

  const target = goal?.targetCalories ?? 0;
  const remaining = target - consumed;
  const pct = target > 0 ? Math.min(1, consumed / target) : 0;
  const over = target > 0 && consumed > target;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Nutrition</Text>
          <Pressable
            style={styles.goalBtn}
            onPress={() => router.push('/nutrition/goal')}>
            <Ionicons name={goal ? 'create-outline' : 'flag-outline'} size={16} color={palette.accent} />
            <Text style={styles.goalBtnText}>{goal ? 'Edit goal' : 'Set goal'}</Text>
          </Pressable>
        </View>

        {goal ? (
          <Card style={styles.ringCard}>
            <Text style={styles.remainingLabel}>
              {over ? 'Over by' : 'Remaining today'}
            </Text>
            <Text style={[styles.remainingValue, over && { color: palette.danger }]}>
              {Math.abs(remaining)}
              <Text style={styles.kcal}> kcal</Text>
            </Text>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  { width: `${pct * 100}%`, backgroundColor: over ? palette.danger : palette.accent },
                ]}
              />
            </View>
            <View style={styles.consumedRow}>
              <Text style={styles.consumedText}>{consumed} eaten</Text>
              <Text style={styles.consumedText}>{target} target</Text>
            </View>

            <View style={styles.macros}>
              <Macro label="Protein" value={Math.round(protein)} target={goal.proteinTargetG} />
              <Macro label="Carbs" value={Math.round(carbs)} target={goal.carbsTargetG} />
              <Macro label="Fat" value={Math.round(fat)} target={goal.fatTargetG} />
            </View>
          </Card>
        ) : (
          <Card>
            <Text style={styles.setupTitle}>Set your goal</Text>
            <Text style={styles.setupBody}>
              Tell us your stats and target weight, and AI will calculate the daily calories to get
              you there.
            </Text>
            <AppButton
              label="Set my goal"
              icon="flag"
              onPress={() => router.push('/nutrition/goal')}
              style={{ marginTop: Spacing.four }}
            />
          </Card>
        )}

        <AppButton
          label="Scan food"
          icon="camera"
          onPress={() => router.push('/nutrition/scan')}
          style={{ marginTop: Spacing.one }}
        />

        <Text style={styles.sectionTitle}>Today&apos;s log</Text>
        {today.length === 0 ? (
          <Text style={styles.empty}>Nothing logged yet. Scan a meal to get started.</Text>
        ) : (
          today.map((e) => (
            <Card key={e.id} style={styles.entry}>
              <View style={{ flex: 1 }}>
                <Text style={styles.entryName}>{e.label}</Text>
                <Text style={styles.entryMeta}>
                  {formatTime(e.loggedAt)} · P{Math.round(e.protein_g)} C{Math.round(e.carbs_g)} F
                  {Math.round(e.fat_g)}
                </Text>
              </View>
              <Text style={styles.entryCals}>{e.calories}</Text>
              <Pressable onPress={() => deleteEntry(e.id)} hitSlop={8} style={{ marginLeft: Spacing.three }}>
                <Ionicons name="close-circle" size={20} color={palette.muted} />
              </Pressable>
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Macro({ label, value, target }: { label: string; value: number; target: number }) {
  const pct = target > 0 ? Math.min(1, value / target) : 0;
  return (
    <View style={styles.macro}>
      <Text style={styles.macroLabel}>{label}</Text>
      <View style={styles.macroTrack}>
        <View style={[styles.macroFill, { width: `${pct * 100}%` }]} />
      </View>
      <Text style={styles.macroVal}>
        {value}/{target}g
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bg },
  content: { padding: Spacing.four, paddingBottom: Spacing.eight, gap: Spacing.three },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: palette.fg, fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  goalBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  goalBtnText: { color: palette.accent, fontSize: 14, fontWeight: '700' },

  ringCard: { alignItems: 'center' },
  remainingLabel: { color: palette.muted, fontSize: 14, fontWeight: '600' },
  remainingValue: { color: palette.fg, fontSize: 48, fontWeight: '800', letterSpacing: -1, marginTop: Spacing.one },
  kcal: { fontSize: 18, fontWeight: '600', color: palette.muted },
  barTrack: {
    alignSelf: 'stretch',
    height: 10,
    borderRadius: Radius.full,
    backgroundColor: palette.surface2,
    overflow: 'hidden',
    marginTop: Spacing.three,
  },
  barFill: { height: '100%', borderRadius: Radius.full },
  consumedRow: { alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.two },
  consumedText: { color: palette.muted, fontSize: 13 },

  macros: { alignSelf: 'stretch', gap: Spacing.two, marginTop: Spacing.four },
  macro: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  macroLabel: { color: palette.fg, fontSize: 13, width: 56 },
  macroTrack: { flex: 1, height: 6, borderRadius: Radius.full, backgroundColor: palette.surface2, overflow: 'hidden' },
  macroFill: { height: '100%', backgroundColor: palette.accent2, borderRadius: Radius.full },
  macroVal: { color: palette.muted, fontSize: 12, width: 72, textAlign: 'right' },

  setupTitle: { color: palette.fg, fontSize: 20, fontWeight: '800' },
  setupBody: { color: palette.muted, fontSize: 14, lineHeight: 20, marginTop: Spacing.two },

  sectionTitle: { color: palette.fg, fontSize: 18, fontWeight: '700', marginTop: Spacing.three },
  empty: { color: palette.muted, fontSize: 14 },
  entry: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.three },
  entryName: { color: palette.fg, fontSize: 16, fontWeight: '600' },
  entryMeta: { color: palette.muted, fontSize: 12, marginTop: 1 },
  entryCals: { color: palette.accent, fontSize: 18, fontWeight: '800' },
});
