import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/ui';
import { palette, Radius, Spacing } from '@/constants/theme';
import { analyzeFood } from '@/lib/foodApi';
import { captureFoodPhoto } from '@/lib/images';
import type { FoodAnalysis } from '@/lib/types';
import { useNutrition } from '@/store/nutrition';

type Phase = 'idle' | 'analyzing' | 'result' | 'error';

export default function ScanScreen() {
  const router = useRouter();
  const { addEntry } = useNutrition();

  const [phase, setPhase] = useState<Phase>('idle');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<FoodAnalysis | null>(null);
  const [label, setLabel] = useState('');
  const [error, setError] = useState('');

  const start = async (from: 'library' | 'camera') => {
    const photo = await captureFoodPhoto(from);
    if (!photo) return;
    setPhotoUri(photo.uri);
    setPhase('analyzing');
    setError('');
    try {
      const result = await analyzeFood(photo.base64, photo.mimeType);
      setAnalysis(result);
      setLabel(result.items[0]?.name ?? 'Meal');
      setPhase('result');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setPhase('error');
    }
  };

  const save = () => {
    if (!analysis) return;
    addEntry({
      label: label.trim() || 'Meal',
      calories: analysis.total_calories,
      protein_g: analysis.total_protein_g,
      carbs_g: analysis.total_carbs_g,
      fat_g: analysis.total_fat_g,
      photoUri: photoUri ?? undefined,
    });
    router.back();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="close" size={24} color={palette.muted} />
        </Pressable>
        <Text style={styles.topTitle}>Scan food</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {photoUri ? <Image source={{ uri: photoUri }} style={styles.photo} /> : null}

        {phase === 'idle' && (
          <View style={styles.idle}>
            <View style={styles.bigIcon}>
              <Ionicons name="restaurant-outline" size={36} color={palette.accent} />
            </View>
            <Text style={styles.idleTitle}>Snap your meal</Text>
            <Text style={styles.idleBody}>
              Take a photo of your food and AI will estimate the calories and macros.
            </Text>
            <AppButton label="Take photo" icon="camera" onPress={() => start('camera')} style={styles.actionBtn} />
            <AppButton
              label="Choose from library"
              icon="images"
              variant="secondary"
              onPress={() => start('library')}
              style={styles.actionBtn}
            />
          </View>
        )}

        {phase === 'analyzing' && (
          <View style={styles.center}>
            <ActivityIndicator color={palette.accent} size="large" />
            <Text style={styles.analyzing}>Analyzing your meal…</Text>
          </View>
        )}

        {phase === 'error' && (
          <View style={styles.center}>
            <Ionicons name="alert-circle-outline" size={32} color={palette.danger} />
            <Text style={styles.errorText}>{error}</Text>
            <AppButton label="Try again" icon="refresh" onPress={() => setPhase('idle')} style={styles.actionBtn} />
          </View>
        )}

        {phase === 'result' && analysis && (
          <View>
            <View style={styles.totalCard}>
              <Text style={styles.totalCals}>{analysis.total_calories}</Text>
              <Text style={styles.totalUnit}>calories</Text>
              <View style={styles.macroRow}>
                <MacroChip label="Protein" value={analysis.total_protein_g} />
                <MacroChip label="Carbs" value={analysis.total_carbs_g} />
                <MacroChip label="Fat" value={analysis.total_fat_g} />
              </View>
              <View style={[styles.confidence, confStyle(analysis.confidence)]}>
                <Text style={styles.confidenceText}>{analysis.confidence} confidence</Text>
              </View>
            </View>

            <Text style={styles.label}>Label</Text>
            <TextInput
              style={styles.input}
              value={label}
              onChangeText={setLabel}
              placeholder="Meal name"
              placeholderTextColor={palette.muted}
            />

            <Text style={styles.label}>Detected items</Text>
            {analysis.items.length === 0 ? (
              <Text style={styles.noItems}>No food detected. Try a clearer photo.</Text>
            ) : (
              analysis.items.map((it, i) => (
                <View key={i} style={styles.itemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{it.name}</Text>
                    <Text style={styles.itemQty}>{it.quantity}</Text>
                  </View>
                  <Text style={styles.itemCals}>{it.calories} kcal</Text>
                </View>
              ))
            )}

            {analysis.notes ? <Text style={styles.notes}>{analysis.notes}</Text> : null}

            <AppButton label="Add to today's log" icon="checkmark" onPress={save} style={{ marginTop: Spacing.five }} />
            <AppButton
              label="Retake"
              icon="camera-reverse"
              variant="ghost"
              onPress={() => setPhase('idle')}
              style={{ marginTop: Spacing.one }}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function MacroChip({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipValue}>{Math.round(value)}g</Text>
      <Text style={styles.chipLabel}>{label}</Text>
    </View>
  );
}

function confStyle(c: FoodAnalysis['confidence']) {
  if (c === 'high') return { borderColor: palette.accent };
  if (c === 'medium') return { borderColor: palette.accent2 };
  return { borderColor: palette.muted };
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  topTitle: { color: palette.fg, fontSize: 17, fontWeight: '700' },
  content: { padding: Spacing.four, paddingBottom: Spacing.eight },
  photo: { width: '100%', height: 200, borderRadius: Radius.lg, marginBottom: Spacing.four },

  idle: { alignItems: 'center', paddingTop: Spacing.six, gap: Spacing.two },
  bigIcon: {
    width: 72,
    height: 72,
    borderRadius: Radius.full,
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  idleTitle: { color: palette.fg, fontSize: 20, fontWeight: '800' },
  idleBody: { color: palette.muted, fontSize: 14, textAlign: 'center', maxWidth: 280, lineHeight: 20 },
  actionBtn: { alignSelf: 'stretch', marginTop: Spacing.three },

  center: { alignItems: 'center', paddingTop: Spacing.eight, gap: Spacing.three },
  analyzing: { color: palette.muted, fontSize: 15 },
  errorText: { color: palette.fg, fontSize: 15, textAlign: 'center', maxWidth: 300 },

  totalCard: {
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.five,
  },
  totalCals: { color: palette.accent, fontSize: 48, fontWeight: '800', letterSpacing: -1 },
  totalUnit: { color: palette.muted, fontSize: 14, marginTop: -Spacing.one },
  macroRow: { flexDirection: 'row', gap: Spacing.three, marginTop: Spacing.four },
  chip: { alignItems: 'center', backgroundColor: palette.surface2, borderRadius: Radius.md, paddingVertical: Spacing.two, paddingHorizontal: Spacing.four },
  chipValue: { color: palette.fg, fontSize: 16, fontWeight: '800' },
  chipLabel: { color: palette.muted, fontSize: 12 },
  confidence: {
    marginTop: Spacing.four,
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  confidenceText: { color: palette.fg, fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },

  label: { color: palette.muted, fontSize: 13, fontWeight: '700', marginTop: Spacing.four, marginBottom: Spacing.two },
  input: {
    color: palette.fg,
    fontSize: 16,
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  noItems: { color: palette.muted, fontSize: 14 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.three,
    marginBottom: Spacing.two,
  },
  itemName: { color: palette.fg, fontSize: 15, fontWeight: '600' },
  itemQty: { color: palette.muted, fontSize: 12, marginTop: 1 },
  itemCals: { color: palette.accent, fontSize: 15, fontWeight: '700' },
  notes: { color: palette.muted, fontSize: 13, lineHeight: 18, marginTop: Spacing.three, fontStyle: 'italic' },
});
