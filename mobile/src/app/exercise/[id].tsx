import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBackground } from '@/components/AppBackground';
import { EmptyState, Loading } from '@/components/ui';
import { LineChart } from '@/components/LineChart';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { formatDate, formatVolume } from '@/lib/format';
import { exerciseHistory } from '@/lib/stats';
import { useTheme, useThemedStyles } from '@/store/theme';
import { useWorkouts } from '@/store/workouts';

export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { loaded, exercises, sessions } = useWorkouts();
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);

  if (!loaded) return <Loading />;

  const exercise = exercises.find((e) => e.id === id);
  const history = exerciseHistory(sessions, id);

  const bestRM = history.length ? Math.max(...history.map((p) => p.oneRM)) : 0;
  const latestRM = history.length ? history[history.length - 1].oneRM : 0;
  const topWeight = history.length ? Math.max(...history.map((p) => p.topWeight)) : 0;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: 'transparent' }]} edges={['top', 'bottom']}>
      <AppBackground />
      <View style={styles.topBar}>
        <Ionicons name="chevron-back" size={26} color={palette.fg} onPress={() => router.back()} />
        <Text style={styles.topTitle} numberOfLines={1}>
          {exercise?.name ?? 'Exercise'}
        </Text>
        <View style={{ width: 26 }} />
      </View>

      {history.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="trending-up-outline"
            title="No history yet"
            body="Log this exercise with weight and reps in a workout, and your progress will chart here."
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.statsRow}>
            <Stat value={String(bestRM)} label="Best 1RM" styles={styles} accent={palette.accent} />
            <Stat value={String(latestRM)} label="Latest 1RM" styles={styles} />
            <Stat value={`${topWeight} lb`} label="Top weight" styles={styles} />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Estimated 1RM over time</Text>
            <LineChart
              values={history.map((p) => p.oneRM)}
              labels={[formatDate(history[0].at), formatDate(history[history.length - 1].at)]}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Volume per session</Text>
            <LineChart
              color={palette.accent2}
              values={history.map((p) => p.volume)}
              labels={[formatDate(history[0].at), formatDate(history[history.length - 1].at)]}
            />
          </View>

          <Text style={styles.sectionTitle}>Sessions</Text>
          {[...history].reverse().map((p, i) => (
            <View key={i} style={styles.row}>
              <Text style={styles.rowDate}>{formatDate(p.at)}</Text>
              <Text style={styles.rowMeta}>
                {p.oneRM} 1RM · {p.topWeight} lb · {formatVolume(p.volume)}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Stat({
  value,
  label,
  styles,
  accent,
}: {
  value: string;
  label: string;
  styles: ReturnType<typeof makeStyles>;
  accent?: string;
}) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, accent ? { color: accent } : null]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
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
    topTitle: { color: palette.fg, fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center' },
    content: { padding: Spacing.four, paddingBottom: Spacing.eight, gap: Spacing.three },
    emptyWrap: { flex: 1, justifyContent: 'center' },

    statsRow: { flexDirection: 'row', gap: Spacing.three },
    stat: {
      flex: 1,
      backgroundColor: palette.surface,
      borderColor: palette.border,
      borderWidth: 1,
      borderRadius: Radius.md,
      padding: Spacing.three,
      alignItems: 'center',
      gap: 2,
    },
    statValue: { color: palette.fg, fontSize: 20, fontWeight: '800' },
    statLabel: { color: palette.muted, fontSize: 12 },

    card: {
      backgroundColor: palette.surface,
      borderColor: palette.border,
      borderWidth: 1,
      borderRadius: Radius.lg,
      padding: Spacing.four,
      gap: Spacing.three,
    },
    cardTitle: { color: palette.fg, fontSize: 15, fontWeight: '700' },

    sectionTitle: { color: palette.fg, fontSize: 18, fontWeight: '700', marginTop: Spacing.two },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: Spacing.three,
      borderTopColor: palette.border,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    rowDate: { color: palette.fg, fontSize: 14, fontWeight: '600' },
    rowMeta: { color: palette.muted, fontSize: 13 },
  });
