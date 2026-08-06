import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, EmptyState, Loading } from '@/components/ui';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { formatDate, formatDuration, formatVolume } from '@/lib/format';
import { computeRecords, type ExercisePR } from '@/lib/stats';
import { useTheme, useThemedStyles } from '@/store/theme';
import { useWorkouts } from '@/store/workouts';

export default function RecordsScreen() {
  const router = useRouter();
  const { loaded, sessions } = useWorkouts();
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);

  if (!loaded) return <Loading />;

  const r = computeRecords(sessions);
  const hasAny = r.totalPRs > 0 || r.heaviestLift !== null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <View style={styles.backBtn}>
          <Ionicons
            name="chevron-back"
            size={26}
            color={palette.fg}
            onPress={() => router.back()}
          />
        </View>
        <Text style={styles.topTitle}>Personal records</Text>
        <View style={styles.backBtn} />
      </View>

      {!hasAny ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="trophy-outline"
            title="No records yet"
            body="Finish a workout with weight and reps logged, and your all-time bests will show up here."
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* All-time highlights */}
          <View style={styles.highlightRow}>
            {r.heaviestLift ? (
              <Highlight
                icon="barbell"
                label="Heaviest lift"
                value={`${r.heaviestLift.value} lb`}
                sub={`${r.heaviestLift.name} · ×${r.heaviestLift.reps}`}
              />
            ) : null}
            {r.bestSessionVolume ? (
              <Highlight
                icon="trending-up"
                label="Best session"
                value={formatVolume(r.bestSessionVolume.value)}
                sub={r.bestSessionVolume.name}
              />
            ) : null}
          </View>
          {r.longestSessionMs ? (
            <Highlight
              icon="timer"
              label="Longest workout"
              value={formatDuration(0, r.longestSessionMs.value)}
              sub={`${r.longestSessionMs.name} · ${formatDate(r.longestSessionMs.at)}`}
              full
            />
          ) : null}

          {/* Per-exercise PRs */}
          <Text style={styles.sectionTitle}>By exercise</Text>
          {r.exercises.length === 0 ? (
            <Text style={styles.note}>
              Log weight × reps on your sets to build per-exercise records.
            </Text>
          ) : (
            r.exercises.map((pr) => <PRCard key={pr.exerciseId} pr={pr} />)
          )}

          <Text style={styles.disclaimer}>
            Estimated 1RM uses the Epley formula (weight × (1 + reps ÷ 30)).
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Highlight({
  icon,
  label,
  value,
  sub,
  full,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  sub: string;
  full?: boolean;
}) {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <Card style={[styles.highlight, full ? { flex: undefined } : { flex: 1 }]}>
      <View style={styles.highlightHead}>
        <Ionicons name={icon} size={16} color={palette.accent} />
        <Text style={styles.highlightLabel}>{label}</Text>
      </View>
      <Text style={styles.highlightValue}>{value}</Text>
      <Text style={styles.highlightSub} numberOfLines={1}>
        {sub}
      </Text>
    </Card>
  );
}

function PRCard({ pr }: { pr: ExercisePR }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Card style={styles.prCard}>
      <View style={styles.prHead}>
        <View style={{ flex: 1 }}>
          <Text style={styles.prName} numberOfLines={1}>
            {pr.name}
          </Text>
          <Text style={styles.prMuscle}>{pr.muscle}</Text>
        </View>
        <View style={styles.oneRm}>
          <Text style={styles.oneRmValue}>{pr.best1RM}</Text>
          <Text style={styles.oneRmLabel}>est. 1RM</Text>
        </View>
      </View>
      <View style={styles.prStats}>
        <PRStat label="Heaviest" value={`${pr.heaviestWeight} lb × ${pr.heaviestWeightReps}`} />
        <PRStat label="Most reps" value={`${pr.bestReps}`} />
        <PRStat label="Best set" value={formatVolume(pr.bestSetVolume)} />
      </View>
      <Text style={styles.prDate}>Best on {formatDate(pr.achievedAt)}</Text>
    </Card>
  );
}

function PRStat({ label, value }: { label: string; value: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.prStat}>
      <Text style={styles.prStatValue}>{value}</Text>
      <Text style={styles.prStatLabel}>{label}</Text>
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
  backBtn: { width: 40, height: 28, justifyContent: 'center' },
  topTitle: { color: palette.fg, fontSize: 17, fontWeight: '700' },
  content: { padding: Spacing.four, paddingBottom: Spacing.eight, gap: Spacing.three },
  emptyWrap: { flex: 1, justifyContent: 'center' },

  highlightRow: { flexDirection: 'row', gap: Spacing.three },
  highlight: { gap: Spacing.one },
  highlightHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  highlightLabel: { color: palette.muted, fontSize: 12, fontWeight: '700' },
  highlightValue: { color: palette.fg, fontSize: 22, fontWeight: '800', marginTop: 2 },
  highlightSub: { color: palette.muted, fontSize: 12 },

  sectionTitle: { color: palette.fg, fontSize: 18, fontWeight: '700', marginTop: Spacing.two },
  note: { color: palette.muted, fontSize: 14, lineHeight: 20 },

  prCard: { gap: Spacing.three },
  prHead: { flexDirection: 'row', alignItems: 'center' },
  prName: { color: palette.fg, fontSize: 16, fontWeight: '700' },
  prMuscle: { color: palette.muted, fontSize: 12, marginTop: 1 },
  oneRm: {
    alignItems: 'center',
    backgroundColor: palette.surface2,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  oneRmValue: { color: palette.accent, fontSize: 20, fontWeight: '800' },
  oneRmLabel: { color: palette.muted, fontSize: 10, fontWeight: '600', textTransform: 'uppercase' },

  prStats: { flexDirection: 'row', gap: Spacing.two },
  prStat: {
    flex: 1,
    backgroundColor: palette.bg,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    gap: 1,
  },
  prStatValue: { color: palette.fg, fontSize: 14, fontWeight: '700' },
  prStatLabel: { color: palette.muted, fontSize: 11 },
  prDate: { color: palette.muted, fontSize: 12 },

  disclaimer: { color: palette.muted, fontSize: 11, textAlign: 'center', marginTop: Spacing.two, lineHeight: 16 },
});
