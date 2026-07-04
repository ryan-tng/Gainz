import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, Card, Loading } from '@/components/ui';
import { palette, Radius, Spacing } from '@/constants/theme';
import { formatDate, formatVolume, startOfWeek } from '@/lib/format';
import { sessionStats } from '@/lib/types';
import { useWorkouts } from '@/store/workouts';

export default function TodayScreen() {
  const router = useRouter();
  const { loaded, active, sessions, startWorkout } = useWorkouts();

  if (!loaded) return <Loading />;

  const weekStart = startOfWeek();
  const thisWeek = sessions.filter((s) => (s.finishedAt ?? s.startedAt) >= weekStart).length;
  const totalVolume = sessions.reduce((sum, s) => sum + sessionStats(s).volume, 0);
  const recent = sessions.slice(0, 3);

  const onStart = () => {
    if (!active) startWorkout();
    router.push('/workout/active');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.brandRow}>
          <View style={styles.logo}>
            <Ionicons name="barbell" size={20} color={palette.onAccent} />
          </View>
          <Text style={styles.brand}>Gainz</Text>
        </View>

        <Text style={styles.hi}>Ready to train?</Text>

        {active ? (
          <Card style={styles.activeCard}>
            <View style={styles.activeTop}>
              <View style={styles.livePulse} />
              <Text style={styles.activeLabel}>Workout in progress</Text>
            </View>
            <Text style={styles.activeName}>{active.name}</Text>
            <Text style={styles.activeMeta}>
              {active.exercises.length} exercise{active.exercises.length === 1 ? '' : 's'} ·
              started {formatDate(active.startedAt)}
            </Text>
            <AppButton
              label="Resume workout"
              icon="play"
              onPress={() => router.push('/workout/active')}
              style={{ marginTop: Spacing.four }}
            />
          </Card>
        ) : (
          <Card style={styles.startCard}>
            <Text style={styles.startTitle}>Start a workout</Text>
            <Text style={styles.startBody}>
              Log your exercises, sets, reps, and weight. Everything saves to your history.
            </Text>
            <AppButton
              label="Start workout"
              icon="add"
              onPress={onStart}
              style={{ marginTop: Spacing.four }}
            />
          </Card>
        )}

        <View style={styles.statsRow}>
          <Stat label="This week" value={String(thisWeek)} unit="workouts" />
          <Stat label="All time" value={String(sessions.length)} unit="workouts" />
          <Stat label="Volume" value={formatVolume(totalVolume)} unit="lifted" />
        </View>

        <View style={styles.recentHeader}>
          <Text style={styles.sectionTitle}>Recent</Text>
          {sessions.length > 3 && (
            <Pressable onPress={() => router.push('/history')}>
              <Text style={styles.link}>See all</Text>
            </Pressable>
          )}
        </View>

        {recent.length === 0 ? (
          <Text style={styles.noRecent}>No workouts yet. Your first one will show up here.</Text>
        ) : (
          recent.map((s) => {
            const st = sessionStats(s);
            return (
              <Pressable key={s.id} onPress={() => router.push(`/session/${s.id}`)}>
                <Card style={styles.recentCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recentName}>{s.name}</Text>
                    <Text style={styles.recentMeta}>
                      {formatDate(s.finishedAt ?? s.startedAt)} · {st.exercises} exercises · {st.sets} sets
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={palette.muted} />
                </Card>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statUnit}>{unit}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bg },
  content: { padding: Spacing.four, paddingBottom: Spacing.eight, gap: Spacing.four },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  logo: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: { color: palette.fg, fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  hi: { color: palette.fg, fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginTop: Spacing.two },

  activeCard: { borderColor: palette.accent, backgroundColor: palette.surface },
  activeTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  livePulse: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.accent },
  activeLabel: { color: palette.accent, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  activeName: { color: palette.fg, fontSize: 22, fontWeight: '800', marginTop: Spacing.two },
  activeMeta: { color: palette.muted, fontSize: 14, marginTop: Spacing.one },

  startCard: {},
  startTitle: { color: palette.fg, fontSize: 20, fontWeight: '800' },
  startBody: { color: palette.muted, fontSize: 14, lineHeight: 20, marginTop: Spacing.two },

  statsRow: { flexDirection: 'row', gap: Spacing.three },
  stat: {
    flex: 1,
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.three,
    gap: 2,
  },
  statValue: { color: palette.accent, fontSize: 22, fontWeight: '800' },
  statLabel: { color: palette.fg, fontSize: 13, fontWeight: '600' },
  statUnit: { color: palette.muted, fontSize: 12 },

  recentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.two },
  sectionTitle: { color: palette.fg, fontSize: 18, fontWeight: '700' },
  link: { color: palette.accent, fontSize: 14, fontWeight: '600' },
  noRecent: { color: palette.muted, fontSize: 14 },

  recentCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.three },
  recentName: { color: palette.fg, fontSize: 16, fontWeight: '700' },
  recentMeta: { color: palette.muted, fontSize: 13, marginTop: 2 },
});
