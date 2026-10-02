import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBackground } from '@/components/AppBackground';
import { AppButton, Card, Loading } from '@/components/ui';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { notify } from '@/lib/confirm';
import { endOfDay, formatTime, startOfDay } from '@/lib/format';
import { getAdaptiveTdee, type AdaptiveTdee } from '@/lib/mlApi';
import { useNutrition } from '@/store/nutrition';
import { useProfile } from '@/store/profile';
import { useTheme, useThemedStyles } from '@/store/theme';

export default function NutritionScreen() {
  const router = useRouter();
  const { loaded, goal, entriesForDay } = useNutrition();
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);

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
    <SafeAreaView style={[styles.safe, { backgroundColor: 'transparent' }]} edges={['top']}>
      <AppBackground />
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
          label="Search foods"
          icon="search"
          onPress={() => router.push('/nutrition/search')}
          style={{ marginTop: Spacing.one }}
        />
        <View style={styles.logRow}>
          <AppButton
            label="Scan food"
            icon="camera"
            variant="secondary"
            onPress={() => router.push('/nutrition/scan')}
            style={styles.logBtn}
          />
          <AppButton
            label="Add manually"
            icon="create-outline"
            variant="secondary"
            onPress={() => router.push('/nutrition/add')}
            style={styles.logBtn}
          />
        </View>

        {goal ? (
          <AppButton
            label="AI coaching plan"
            icon="sparkles"
            variant="secondary"
            onPress={() => router.push('/nutrition/coach')}
          />
        ) : null}

        {goal ? <AdaptiveCard /> : null}

        <Text style={styles.sectionTitle}>Today&apos;s log</Text>
        {today.length === 0 ? (
          <Text style={styles.empty}>Nothing logged yet. Scan a meal to get started.</Text>
        ) : (
          today.map((e) => (
            <Pressable key={e.id} onPress={() => router.push(`/nutrition/add?id=${e.id}`)}>
              <Card style={styles.entry}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.entryName}>{e.label}</Text>
                  <Text style={styles.entryMeta}>
                    {formatTime(e.loggedAt)} · P{Math.round(e.protein_g)} C{Math.round(e.carbs_g)} F
                    {Math.round(e.fat_g)}
                  </Text>
                </View>
                <Text style={styles.entryCals}>{e.calories}</Text>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={palette.muted}
                  style={{ marginLeft: Spacing.three }}
                />
              </Card>
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * Adaptive Target card — asks the Python ML service to fit the user's true
 * maintenance calories from their weight trend + logged intake, then lets them
 * apply the recommended target to their goal. Runs on demand (it calls a paid-
 * free remote service and needs real data to be meaningful).
 */
function AdaptiveCard() {
  const { goal, entries, applyTargetCalories } = useNutrition();
  const { bodyWeights } = useProfile();
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AdaptiveTdee | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!goal) return null;

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const losing = goal.targetWeightLb < goal.currentWeightLb;
      const signedRate = (losing ? -1 : 1) * goal.weeklyRateLb;
      const res = await getAdaptiveTdee(bodyWeights, entries, signedRate);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reach the adaptive model.');
    } finally {
      setLoading(false);
    }
  };

  const apply = () => {
    if (!result) return;
    applyTargetCalories(result.recommended_target);
    notify('Target updated', `Your daily goal is now ${result.recommended_target} kcal.`);
  };

  const trend = result?.trend_lb_per_week ?? 0;
  const trendText =
    Math.abs(trend) < 0.05
      ? 'holding steady'
      : `${trend > 0 ? '+' : ''}${trend.toFixed(1)} lb/wk`;

  return (
    <Card style={styles.adaptiveCard}>
      <View style={styles.adaptiveHead}>
        <Ionicons name="analytics-outline" size={18} color={palette.accent} />
        <Text style={styles.adaptiveTitle}>Adaptive target</Text>
      </View>
      <Text style={styles.adaptiveSub}>
        Learns your real maintenance from your weight trend and logged food — more accurate than the
        formula as you log more.
      </Text>

      {result && !result.needs_more_data ? (
        <>
          <View style={styles.adaptiveStats}>
            <View style={styles.adaptiveStat}>
              <Text style={styles.adaptiveStatVal}>{result.maintenance_calories}</Text>
              <Text style={styles.adaptiveStatLabel}>maintenance</Text>
            </View>
            <View style={styles.adaptiveStat}>
              <Text style={styles.adaptiveStatVal}>{trendText}</Text>
              <Text style={styles.adaptiveStatLabel}>trend</Text>
            </View>
            <View style={styles.adaptiveStat}>
              <Text style={[styles.adaptiveStatVal, { color: palette.accent }]}>
                {result.recommended_target}
              </Text>
              <Text style={styles.adaptiveStatLabel}>suggested</Text>
            </View>
          </View>
          {result.note ? <Text style={styles.adaptiveNote}>{result.note}</Text> : null}
          <Text style={styles.adaptiveMeta}>
            {result.confidence} confidence · {result.days_analyzed} days analyzed
          </Text>
          {result.recommended_target !== goal.targetCalories ? (
            <AppButton
              label={`Use ${result.recommended_target} kcal as my target`}
              icon="checkmark-circle"
              onPress={apply}
              style={{ marginTop: Spacing.three }}
            />
          ) : (
            <Text style={[styles.adaptiveMeta, { marginTop: Spacing.two }]}>
              This already matches your current target.
            </Text>
          )}
        </>
      ) : null}

      {result?.needs_more_data ? <Text style={styles.adaptiveNote}>{result.note}</Text> : null}
      {error ? <Text style={styles.adaptiveError}>{error}</Text> : null}

      <Pressable style={styles.adaptiveRun} onPress={run} disabled={loading}>
        {loading ? (
          <ActivityIndicator size="small" color={palette.accent} />
        ) : (
          <Ionicons name="refresh" size={16} color={palette.accent} />
        )}
        <Text style={styles.adaptiveRunText}>
          {loading ? 'Analyzing…' : result ? 'Recalculate' : 'Analyze my data'}
        </Text>
      </Pressable>
    </Card>
  );
}

function Macro({ label, value, target }: { label: string; value: number; target: number }) {
  const styles = useThemedStyles(makeStyles);
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

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bg },
  content: { padding: Spacing.four, paddingBottom: Spacing.eight, gap: Spacing.three },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: palette.fg, fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  goalBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  goalBtnText: { color: palette.accent, fontSize: 14, fontWeight: '700' },

  logRow: { flexDirection: 'row', gap: Spacing.three, marginTop: Spacing.one },
  logBtn: { flex: 1 },

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

  adaptiveCard: { gap: Spacing.two },
  adaptiveHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  adaptiveTitle: { color: palette.fg, fontSize: 17, fontWeight: '800' },
  adaptiveSub: { color: palette.muted, fontSize: 13, lineHeight: 18 },
  adaptiveStats: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
  adaptiveStat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Radius.md,
    backgroundColor: palette.surface2,
  },
  adaptiveStatVal: { color: palette.fg, fontSize: 16, fontWeight: '800' },
  adaptiveStatLabel: { color: palette.muted, fontSize: 11, marginTop: 2 },
  adaptiveNote: { color: palette.fg, fontSize: 13, lineHeight: 19, marginTop: Spacing.two },
  adaptiveMeta: { color: palette.muted, fontSize: 12, marginTop: Spacing.one, textTransform: 'capitalize' },
  adaptiveError: { color: palette.danger, fontSize: 13, marginTop: Spacing.two },
  adaptiveRun: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    marginTop: Spacing.three,
    paddingVertical: Spacing.two,
  },
  adaptiveRunText: { color: palette.accent, fontSize: 14, fontWeight: '700' },

  setupTitle: { color: palette.fg, fontSize: 20, fontWeight: '800' },
  setupBody: { color: palette.muted, fontSize: 14, lineHeight: 20, marginTop: Spacing.two },

  sectionTitle: { color: palette.fg, fontSize: 18, fontWeight: '700', marginTop: Spacing.three },
  empty: { color: palette.muted, fontSize: 14 },
  entry: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.three },
  entryName: { color: palette.fg, fontSize: 16, fontWeight: '600' },
  entryMeta: { color: palette.muted, fontSize: 12, marginTop: 1 },
  entryCals: { color: palette.accent, fontSize: 18, fontWeight: '800' },
});
