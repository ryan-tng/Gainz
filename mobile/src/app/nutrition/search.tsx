import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBackground } from '@/components/AppBackground';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { searchFoods, type FoodDbItem } from '@/lib/foodDb';
import { useTheme, useThemedStyles } from '@/store/theme';

export default function FoodSearchScreen() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodDbItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  // Debounced search as the user types.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        setResults(await searchFoods(q, ctrl.signal));
        setSearched(true);
      } catch (e) {
        if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : 'Search failed.');
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 450);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  const pick = (item: FoodDbItem) => {
    router.push({
      pathname: '/nutrition/add',
      params: {
        label: item.brand ? `${item.name} (${item.brand})` : item.name,
        calories: String(item.calories),
        protein: String(item.protein_g),
        carbs: String(item.carbs_g),
        fat: String(item.fat_g),
      },
    });
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: 'transparent' }]} edges={['top', 'bottom']}>
      <AppBackground />
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={16} style={styles.side}>
          <Ionicons name="chevron-back" size={26} color={palette.fg} />
        </Pressable>
        <Text style={styles.topTitle}>Search foods</Text>
        <Pressable onPress={() => router.push('/nutrition/barcode')} hitSlop={16} style={styles.side}>
          <Ionicons name="barcode-outline" size={24} color={palette.accent} />
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={palette.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search foods (e.g. greek yogurt)"
          placeholderTextColor={palette.muted}
          style={styles.search}
          autoFocus
          autoCorrect={false}
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={palette.muted} />
          </Pressable>
        ) : null}
      </View>

      <FlatList
        data={results}
        keyExtractor={(item) => item.code}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <>
            {loading ? (
              <View style={styles.center}>
                <ActivityIndicator color={palette.accent} />
              </View>
            ) : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </>
        }
        ListEmptyComponent={
          !loading && !error ? (
            <Text style={styles.hint}>
              {searched
                ? 'No matches. Try a different term or scan the barcode.'
                : 'Search a food, or tap the barcode icon to scan a package.'}
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => pick(item)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.rowMeta} numberOfLines={1}>
                {item.brand ? `${item.brand} · ` : ''}
                {item.serving} · P{item.protein_g} C{item.carbs_g} F{item.fat_g}
              </Text>
            </View>
            <Text style={styles.rowCals}>{item.calories}</Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
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
    side: { minWidth: 40 },
    topTitle: { color: palette.fg, fontSize: 17, fontWeight: '700' },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.two,
      marginHorizontal: Spacing.four,
      marginTop: Spacing.three,
      paddingHorizontal: Spacing.three,
      backgroundColor: palette.surface,
      borderColor: palette.border,
      borderWidth: 1,
      borderRadius: Radius.md,
    },
    search: { flex: 1, color: palette.fg, fontSize: 16, paddingVertical: Spacing.three },
    list: { padding: Spacing.four, gap: Spacing.two },
    center: { paddingVertical: Spacing.five, alignItems: 'center' },
    error: { color: palette.danger, fontSize: 14, textAlign: 'center', paddingVertical: Spacing.four },
    hint: { color: palette.muted, fontSize: 14, textAlign: 'center', paddingVertical: Spacing.six, lineHeight: 20 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.three,
      backgroundColor: palette.surface,
      borderColor: palette.border,
      borderWidth: 1,
      borderRadius: Radius.md,
      padding: Spacing.three,
    },
    rowName: { color: palette.fg, fontSize: 15, fontWeight: '700' },
    rowMeta: { color: palette.muted, fontSize: 12, marginTop: 1 },
    rowCals: { color: palette.accent, fontSize: 16, fontWeight: '800' },
  });
