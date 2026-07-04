import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, EmptyState, Loading, ScreenHeader } from '@/components/ui';
import { palette, Spacing } from '@/constants/theme';
import { formatDate, formatDuration, formatVolume } from '@/lib/format';
import { sessionStats } from '@/lib/types';
import { useWorkouts } from '@/store/workouts';

export default function HistoryScreen() {
  const router = useRouter();
  const { loaded, sessions } = useWorkouts();

  if (!loaded) return <Loading />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={sessions}
        keyExtractor={(s) => s.id}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <ScreenHeader
            title="History"
            subtitle={sessions.length ? `${sessions.length} workouts logged` : undefined}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="time-outline"
            title="No workouts yet"
            body="Finish a workout from the Today tab and it'll appear here with your stats."
          />
        }
        renderItem={({ item }) => {
          const st = sessionStats(item);
          const end = item.finishedAt ?? item.startedAt;
          return (
            <Pressable onPress={() => router.push(`/session/${item.id}`)}>
              <Card style={styles.card}>
                <View style={styles.row}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Ionicons name="chevron-forward" size={18} color={palette.muted} />
                </View>
                <Text style={styles.date}>{formatDate(end)}</Text>
                <View style={styles.metaRow}>
                  <Meta icon="barbell-outline" text={`${st.exercises} exercises`} />
                  <Meta icon="repeat-outline" text={`${st.sets} sets`} />
                  <Meta icon="trending-up-outline" text={formatVolume(st.volume)} />
                  {item.finishedAt ? (
                    <Meta icon="timer-outline" text={formatDuration(item.startedAt, item.finishedAt)} />
                  ) : null}
                </View>
              </Card>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

function Meta({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.meta}>
      <Ionicons name={icon} size={14} color={palette.muted} />
      <Text style={styles.metaText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bg },
  content: { padding: Spacing.four, paddingBottom: Spacing.eight, gap: Spacing.three },
  card: { gap: Spacing.one },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { color: palette.fg, fontSize: 17, fontWeight: '700' },
  date: { color: palette.muted, fontSize: 13 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three, marginTop: Spacing.two },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: palette.muted, fontSize: 13 },
});
