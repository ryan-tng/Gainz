import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, Card } from '@/components/ui';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { getCoachPlan } from '@/lib/coachApi';
import { formatDate, startOfDay } from '@/lib/format';
import { weeksToGoal } from '@/lib/nutrition';
import type { CoachContext, CoachPlan } from '@/lib/types';
import { useNutrition } from '@/store/nutrition';
import { useTheme, useThemedStyles } from '@/store/theme';
import { useWorkouts } from '@/store/workouts';

const DAY_MS = 24 * 60 * 60 * 1000;

type Feasibility = { label: string; color: string; icon: keyof typeof Ionicons.glyphMap };

function feasibilityMeta(palette: Palette): Record<CoachPlan['feasibility'], Feasibility> {
  return {
    conservative: { label: 'Conservative', color: palette.accent2, icon: 'leaf-outline' },
    realistic: { label: 'Realistic', color: palette.accent, icon: 'checkmark-circle-outline' },
    aggressive: { label: 'Aggressive', color: '#fbbf24', icon: 'flame-outline' },
    unsafe: { label: 'Unsafe', color: palette.danger, icon: 'warning-outline' },
  };
}

export default function CoachScreen() {
  const router = useRouter();
  const { goal, entries, coachPlan, coachPlanAt, saveCoachPlan } = useNutrition();
  const { sessions } = useWorkouts();
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Summarize recent training + logging so the coach has real context. */
  const buildContext = (): CoachContext => {
    const now = Date.now();
    const since28 = now - 28 * DAY_MS;
    const since14 = startOfDay(now) - 13 * DAY_MS;

    const workoutsLast28Days = sessions.filter(
      (s) => (s.finishedAt ?? s.startedAt) >= since28,
    ).length;

    const recentEntries = entries.filter((e) => e.loggedAt >= since14);
    const days = new Set(recentEntries.map((e) => startOfDay(e.loggedAt)));
    const daysLogged = days.size;

    const totalCals = recentEntries.reduce((s, e) => s + e.calories, 0);
    const totalProtein = recentEntries.reduce((s, e) => s + e.protein_g, 0);

    return {
      workoutsLast28Days,
      workoutsPerWeek: Math.round((workoutsLast28Days / 4) * 10) / 10,
      daysLoggedLast14: daysLogged,
      avgDailyCalories: daysLogged ? Math.round(totalCals / daysLogged) : null,
      avgDailyProteinG: daysLogged ? Math.round(totalProtein / daysLogged) : null,
    };
  };

  const generate = async () => {
    if (!goal) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getCoachPlan(goal, weeksToGoal(goal), buildContext());
      saveCoachPlan(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={16} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={palette.fg} />
        </Pressable>
        <Text style={styles.topTitle}>AI Coach</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!goal ? (
          <Card>
            <Text style={styles.emptyTitle}>Set a goal first</Text>
            <Text style={styles.emptyBody}>
              Your coach needs your stats and target weight before it can build a plan.
            </Text>
            <AppButton
              label="Set my goal"
              icon="flag"
              onPress={() => router.replace('/nutrition/goal')}
              style={{ marginTop: Spacing.four }}
            />
          </Card>
        ) : (
          <>
            {/* The deterministic baseline the AI reasons from */}
            <Card style={styles.baseCard}>
              <Text style={styles.baseLabel}>Your calculated baseline</Text>
              <View style={styles.baseRow}>
                <Base value={`${goal.maintenanceCalories}`} label="maintenance" />
                <Base value={`${goal.targetCalories}`} label="target" accent />
                <Base
                  value={weeksToGoal(goal) ? `${weeksToGoal(goal)}w` : '—'}
                  label="to goal"
                />
              </View>
              <Text style={styles.baseNote}>
                Calculated with the Mifflin–St Jeor equation. Your coach builds on these numbers.
              </Text>
            </Card>

            {!coachPlan && !loading ? (
              <AppButton
                label={error ? 'Try again' : 'Get my coaching plan'}
                icon="sparkles"
                onPress={generate}
              />
            ) : null}

            {loading ? (
              <Card style={styles.loadingCard}>
                <ActivityIndicator color={palette.accent} />
                <Text style={styles.loadingText}>Your coach is reviewing your data…</Text>
              </Card>
            ) : null}

            {error ? (
              <Card style={styles.errorCard}>
                <Text style={styles.errorText}>{error}</Text>
              </Card>
            ) : null}

            {coachPlan && !loading ? (
              <PlanView plan={coachPlan} generatedAt={coachPlanAt} onRegenerate={generate} />
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function PlanView({
  plan,
  generatedAt,
  onRegenerate,
}: {
  plan: CoachPlan;
  generatedAt: number | null;
  onRegenerate: () => void;
}) {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const meta = feasibilityMeta(palette);
  const f = meta[plan.feasibility] ?? meta.realistic;

  return (
    <>
      <Card style={[styles.headlineCard, { borderColor: `${f.color}55` }]}>
        <View style={[styles.badge, { backgroundColor: `${f.color}22` }]}>
          <Ionicons name={f.icon} size={14} color={f.color} />
          <Text style={[styles.badgeText, { color: f.color }]}>{f.label}</Text>
        </View>
        <Text style={styles.headline}>{plan.headline}</Text>
        <Text style={styles.assessment}>{plan.assessment}</Text>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Recommended intake</Text>
        <Text style={styles.bigNumber}>
          {plan.recommendedCalories}
          <Text style={styles.bigUnit}> kcal/day</Text>
        </Text>
        <Text style={styles.assessment}>{plan.adjustment}</Text>
      </Card>

      <Text style={styles.sectionTitle}>Focus areas</Text>
      {plan.focus.map((item, i) => (
        <Card key={i} style={styles.focusCard}>
          <View style={styles.focusNum}>
            <Text style={styles.focusNumText}>{i + 1}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.focusTitle}>{item.title}</Text>
            <Text style={styles.focusDetail}>{item.detail}</Text>
          </View>
        </Card>
      ))}

      <Card>
        <Text style={styles.cardTitle}>Training</Text>
        <Text style={styles.assessment}>{plan.training}</Text>
      </Card>

      {plan.warning ? (
        <Card style={styles.warnCard}>
          <View style={styles.warnHead}>
            <Ionicons name="warning-outline" size={16} color={palette.danger} />
            <Text style={styles.warnTitle}>Heads up</Text>
          </View>
          <Text style={styles.warnBody}>{plan.warning}</Text>
        </Card>
      ) : null}

      <AppButton
        label="Regenerate plan"
        icon="refresh"
        variant="secondary"
        onPress={onRegenerate}
        style={{ marginTop: Spacing.two }}
      />
      <Text style={styles.disclaimer}>
        {generatedAt ? `Generated ${formatDate(generatedAt)}. ` : ''}
        AI-generated guidance based on your logged data. Not medical advice.
      </Text>
    </>
  );
}

function Base({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.base}>
      <Text style={[styles.baseValue, accent && { color: palette.accent }]}>{value}</Text>
      <Text style={styles.baseUnit}>{label}</Text>
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
  backBtn: { width: 40 },
  topTitle: { color: palette.fg, fontSize: 17, fontWeight: '700' },
  content: { padding: Spacing.four, paddingBottom: Spacing.eight, gap: Spacing.three },

  emptyTitle: { color: palette.fg, fontSize: 18, fontWeight: '700' },
  emptyBody: { color: palette.muted, fontSize: 14, lineHeight: 20, marginTop: Spacing.two },

  baseCard: { gap: Spacing.three },
  baseLabel: { color: palette.muted, fontSize: 13, fontWeight: '700' },
  baseRow: { flexDirection: 'row', gap: Spacing.three },
  base: { flex: 1, alignItems: 'center' },
  baseValue: { color: palette.fg, fontSize: 22, fontWeight: '800' },
  baseUnit: { color: palette.muted, fontSize: 12, marginTop: 2 },
  baseNote: { color: palette.muted, fontSize: 12, lineHeight: 17 },

  loadingCard: { alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.five },
  loadingText: { color: palette.muted, fontSize: 14 },
  errorCard: { borderColor: palette.danger },
  errorText: { color: palette.danger, fontSize: 14, lineHeight: 20 },

  headlineCard: { gap: Spacing.two },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Radius.full,
  },
  badgeText: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  headline: { color: palette.fg, fontSize: 19, fontWeight: '800', lineHeight: 25 },
  assessment: { color: palette.muted, fontSize: 14, lineHeight: 21, marginTop: Spacing.one },

  cardTitle: { color: palette.fg, fontSize: 15, fontWeight: '700' },
  bigNumber: { color: palette.fg, fontSize: 36, fontWeight: '800', marginTop: Spacing.one },
  bigUnit: { color: palette.muted, fontSize: 15, fontWeight: '600' },

  sectionTitle: { color: palette.fg, fontSize: 18, fontWeight: '700', marginTop: Spacing.two },
  focusCard: { flexDirection: 'row', gap: Spacing.three, alignItems: 'flex-start' },
  focusNum: {
    width: 26,
    height: 26,
    borderRadius: Radius.full,
    backgroundColor: palette.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusNumText: { color: palette.accent, fontSize: 13, fontWeight: '800' },
  focusTitle: { color: palette.fg, fontSize: 15, fontWeight: '700' },
  focusDetail: { color: palette.muted, fontSize: 14, lineHeight: 20, marginTop: 2 },

  warnCard: { borderColor: `${palette.danger}66` },
  warnHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  warnTitle: { color: palette.danger, fontSize: 14, fontWeight: '800' },
  warnBody: { color: palette.muted, fontSize: 14, lineHeight: 20, marginTop: Spacing.two },

  disclaimer: {
    color: palette.muted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: Spacing.two,
    lineHeight: 16,
  },
});
