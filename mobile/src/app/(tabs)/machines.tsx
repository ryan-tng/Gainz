import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState, Loading } from '@/components/ui';
import { palette, Radius, Spacing } from '@/constants/theme';
import { MUSCLE_GROUPS, type MuscleGroup } from '@/lib/types';
import { useMachines } from '@/store/machines';

export default function MachinesScreen() {
  const router = useRouter();
  const { loaded, machines } = useMachines();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<MuscleGroup | 'All'>('All');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return machines
      .filter((m) => (filter === 'All' ? true : m.muscle === filter))
      .filter((m) => (q ? m.name.toLowerCase().includes(q) : true));
  }, [machines, query, filter]);

  if (!loaded) return <Loading />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Machines</Text>
          <Text style={styles.subtitle}>Quick photo tutorials for the gym floor</Text>
        </View>
        <Pressable style={styles.addBtn} onPress={() => router.push('/machine/edit')}>
          <Ionicons name="add" size={20} color={palette.onAccent} />
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={palette.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search machines"
          placeholderTextColor={palette.muted}
          style={styles.search}
          autoCorrect={false}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        contentContainerStyle={styles.filters}>
        {(['All', ...MUSCLE_GROUPS] as const).map((m) => (
          <Pressable
            key={m}
            onPress={() => setFilter(m)}
            style={[styles.filterPill, filter === m && styles.filterPillActive]}>
            <Text style={[styles.filterText, filter === m && styles.filterTextActive]}>{m}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={(m) => m.id}
        numColumns={2}
        columnWrapperStyle={styles.rowWrap}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon="construct-outline"
            title="No machines yet"
            body="Add a machine with a photo and a few how-to steps using the + button."
          />
        }
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => router.push(`/machine/${item.id}`)}>
            <View style={styles.thumb}>
              {item.photos[0] ? (
                <Image source={{ uri: item.photos[0] }} style={styles.thumbImg} />
              ) : (
                <Ionicons name="barbell-outline" size={30} color={palette.muted} />
              )}
              {item.photos.length > 1 ? (
                <View style={styles.photoBadge}>
                  <Ionicons name="images" size={12} color={palette.fg} />
                  <Text style={styles.photoBadgeText}>{item.photos.length}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.cardName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.cardMeta}>
              {item.muscle} · {item.steps.length} step{item.steps.length === 1 ? '' : 's'}
            </Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const CARD_GAP = Spacing.three;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
  },
  title: { color: palette.fg, fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: palette.muted, fontSize: 14, marginTop: 2 },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginHorizontal: Spacing.four,
    paddingHorizontal: Spacing.three,
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  search: { flex: 1, color: palette.fg, fontSize: 16, paddingVertical: Spacing.three },
  filterBar: { flexGrow: 0, flexShrink: 0 },
  filters: { paddingHorizontal: Spacing.four, paddingVertical: Spacing.three, gap: Spacing.two, alignItems: 'center' },
  filterPill: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  filterPillActive: { backgroundColor: palette.accent, borderColor: palette.accent },
  filterText: { color: palette.muted, fontSize: 14, fontWeight: '600' },
  filterTextActive: { color: palette.onAccent },

  grid: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.eight, gap: CARD_GAP },
  rowWrap: { gap: CARD_GAP },
  card: {
    flex: 1,
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.three,
  },
  thumb: {
    height: 110,
    borderRadius: Radius.md,
    backgroundColor: palette.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: Spacing.two,
  },
  thumbImg: { width: '100%', height: '100%' },
  photoBadge: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#000000aa',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },
  photoBadgeText: { color: palette.fg, fontSize: 11, fontWeight: '700' },
  cardName: { color: palette.fg, fontSize: 15, fontWeight: '700' },
  cardMeta: { color: palette.muted, fontSize: 12, marginTop: 1 },
});
