import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, EmptyState } from '@/components/ui';
import { palette, Radius, Spacing } from '@/constants/theme';
import { formatDate, formatDuration, formatTime, formatVolume } from '@/lib/format';
import { sessionStats } from '@/lib/types';
import { useWorkouts } from '@/store/workouts';

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { sessions, deleteSession } = useWorkouts();

  const session = sessions.find((s) => s.id === id);

  if (!session) {
    return (
      <SafeAreaView style={styles.safe}>
        <TopBar onBack={() => router.back()} onDelete={null} />
        <View style={styles.centered}>
          <EmptyState
            icon="alert-circle-outline"
            title="Workout not found"
            body="This workout may have been deleted."
          />
        </View>
      </SafeAreaView>
    );
  }

  const st = sessionStats(session);
  const end = session.finishedAt ?? session.startedAt;

  const onDelete = () => {
    Alert.alert('Delete workout?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteSession(session.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <TopBar onBack={() => router.back()} onDelete={onDelete} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.name}>{session.name}</Text>
        <Text style={styles.date}>
          {formatDate(end)} · {formatTime(session.startedAt)}
          {session.finishedAt ? ` · ${formatDuration(session.startedAt, session.finishedAt)}` : ''}
        </Text>

        <View style={styles.statsRow}>
          <Stat value={String(st.exercises)} label="Exercises" />
          <Stat value={String(st.sets)} label="Sets" />
          <Stat value={formatVolume(st.volume)} label="Volume" />
        </View>

        {session.exercises.map((we) => (
          <Card key={we.id} style={styles.exCard}>
            <Text style={styles.exName}>{we.name}</Text>
            <Text style={styles.exMuscle}>{we.muscle}</Text>
            <View style={styles.setHeader}>
              <Text style={[styles.setHeaderText, styles.colSet]}>Set</Text>
              <Text style={[styles.setHeaderText, styles.colVal]}>Weight</Text>
              <Text style={[styles.setHeaderText, styles.colVal]}>Reps</Text>
            </View>
            {we.sets.map((s, i) => (
              <View key={s.id} style={styles.setRow}>
                <Text style={[styles.setCell, styles.colSet, !s.done && styles.dim]}>{i + 1}</Text>
                <Text style={[styles.setCell, styles.colVal, !s.done && styles.dim]}>
                  {s.weight === null ? '—' : `${s.weight} lb`}
                </Text>
                <Text style={[styles.setCell, styles.colVal, !s.done && styles.dim]}>
                  {s.reps === null ? '—' : s.reps}
                </Text>
              </View>
            ))}
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function TopBar({ onBack, onDelete }: { onBack: () => void; onDelete: (() => void) | null }) {
  return (
    <View style={styles.topBar}>
      <Pressable onPress={onBack} hitSlop={10}>
        <Ionicons name="chevron-back" size={26} color={palette.fg} />
      </Pressable>
      {onDelete ? (
        <Pressable onPress={onDelete} hitSlop={10}>
          <Ionicons name="trash-outline" size={22} color={palette.danger} />
        </Pressable>
      ) : (
        <View />
      )}
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bg },
  centered: { flex: 1, justifyContent: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  content: { padding: Spacing.four, paddingBottom: Spacing.eight, gap: Spacing.three },
  name: { color: palette.fg, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  date: { color: palette.muted, fontSize: 14, marginTop: 2 },

  statsRow: { flexDirection: 'row', gap: Spacing.three, marginTop: Spacing.two, marginBottom: Spacing.two },
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
  statValue: { color: palette.accent, fontSize: 20, fontWeight: '800' },
  statLabel: { color: palette.muted, fontSize: 12 },

  exCard: { gap: 2 },
  exName: { color: palette.fg, fontSize: 17, fontWeight: '700' },
  exMuscle: { color: palette.muted, fontSize: 13 },
  setHeader: { flexDirection: 'row', marginTop: Spacing.three, paddingBottom: Spacing.one },
  setHeaderText: { color: palette.muted, fontSize: 12, fontWeight: '700' },
  colSet: { width: 48 },
  colVal: { flex: 1, textAlign: 'center' },
  setRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.two, borderTopColor: palette.border, borderTopWidth: StyleSheet.hairlineWidth },
  setCell: { color: palette.fg, fontSize: 15, fontWeight: '600' },
  dim: { color: palette.muted, fontWeight: '400' },
});
