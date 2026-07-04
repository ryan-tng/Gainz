import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
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
import { pickFromLibrary, takePhoto } from '@/lib/images';
import { MUSCLE_GROUPS, type MuscleGroup } from '@/lib/types';
import { useMachines } from '@/store/machines';

export default function MachineEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { getMachine, addMachine, updateMachine } = useMachines();
  const existing = id ? getMachine(id) : undefined;

  const [name, setName] = useState(existing?.name ?? '');
  const [muscle, setMuscle] = useState<MuscleGroup>(existing?.muscle ?? 'Legs');
  const [photos, setPhotos] = useState<string[]>(existing?.photos ?? []);
  const [steps, setSteps] = useState<string[]>(existing?.steps.length ? existing.steps : ['']);
  const [tip, setTip] = useState(existing?.tip ?? '');

  const addPhoto = async (from: 'library' | 'camera') => {
    const uri = from === 'library' ? await pickFromLibrary() : await takePhoto();
    if (uri) setPhotos((cur) => [...cur, uri]);
  };

  const setStep = (i: number, value: string) =>
    setSteps((cur) => cur.map((s, idx) => (idx === i ? value : s)));
  const addStep = () => setSteps((cur) => [...cur, '']);
  const removeStep = (i: number) =>
    setSteps((cur) => (cur.length === 1 ? cur : cur.filter((_, idx) => idx !== i)));

  const canSave = name.trim().length > 0;

  const onSave = () => {
    if (!canSave) return;
    const cleanSteps = steps.map((s) => s.trim()).filter(Boolean);
    const input = { name: name.trim(), muscle, photos, steps: cleanSteps, tip: tip.trim() || undefined };
    if (existing) updateMachine(existing.id, input);
    else addMachine(input);
    router.back();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.topSide}>
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
        <Text style={styles.topTitle}>{existing ? 'Edit machine' : 'New machine'}</Text>
        <Pressable onPress={onSave} hitSlop={10} disabled={!canSave} style={styles.topSide}>
          <Text style={[styles.save, !canSave && styles.saveDisabled]}>Save</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Hack Squat"
            placeholderTextColor={palette.muted}
            style={styles.input}
          />

          <Text style={styles.label}>Muscle group</Text>
          <View style={styles.pillWrap}>
            {MUSCLE_GROUPS.map((m) => (
              <Pressable
                key={m}
                onPress={() => setMuscle(m)}
                style={[styles.pill, muscle === m && styles.pillActive]}>
                <Text style={[styles.pillText, muscle === m && styles.pillTextActive]}>{m}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Photos</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
            {photos.map((uri, i) => (
              <View key={i} style={styles.photoThumb}>
                <Image source={{ uri }} style={styles.photoImg} />
                <Pressable
                  style={styles.removePhoto}
                  onPress={() => setPhotos((cur) => cur.filter((_, idx) => idx !== i))}>
                  <Ionicons name="close" size={14} color={palette.fg} />
                </Pressable>
              </View>
            ))}
            <Pressable style={styles.addPhoto} onPress={() => addPhoto('library')}>
              <Ionicons name="images-outline" size={22} color={palette.accent} />
              <Text style={styles.addPhotoText}>Library</Text>
            </Pressable>
            <Pressable style={styles.addPhoto} onPress={() => addPhoto('camera')}>
              <Ionicons name="camera-outline" size={22} color={palette.accent} />
              <Text style={styles.addPhotoText}>Camera</Text>
            </Pressable>
          </ScrollView>

          <Text style={styles.label}>How-to steps</Text>
          {steps.map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={styles.stepNum}>
                <Text style={styles.stepNumText}>{i + 1}</Text>
              </View>
              <TextInput
                value={step}
                onChangeText={(t) => setStep(i, t)}
                placeholder={`Step ${i + 1}`}
                placeholderTextColor={palette.muted}
                style={[styles.input, styles.stepInput]}
                multiline
              />
              <Pressable onPress={() => removeStep(i)} hitSlop={8} style={styles.removeStep}>
                <Ionicons name="remove-circle-outline" size={22} color={palette.muted} />
              </Pressable>
            </View>
          ))}
          <Pressable style={styles.addStep} onPress={addStep}>
            <Ionicons name="add" size={16} color={palette.accent} />
            <Text style={styles.addStepText}>Add step</Text>
          </Pressable>

          <Text style={styles.label}>Tip (optional)</Text>
          <TextInput
            value={tip}
            onChangeText={setTip}
            placeholder="A key form cue or safety note"
            placeholderTextColor={palette.muted}
            style={[styles.input, styles.tipInput]}
            multiline
          />

          <AppButton
            label={existing ? 'Save changes' : 'Add machine'}
            icon="checkmark"
            onPress={onSave}
            disabled={!canSave}
            style={{ marginTop: Spacing.five }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  topSide: { minWidth: 60 },
  topTitle: { color: palette.fg, fontSize: 17, fontWeight: '700' },
  cancel: { color: palette.muted, fontSize: 16 },
  save: { color: palette.accent, fontSize: 16, fontWeight: '800', textAlign: 'right' },
  saveDisabled: { color: palette.muted },

  content: { padding: Spacing.four, paddingBottom: Spacing.eight },
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
  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  pill: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  pillActive: { backgroundColor: palette.accent, borderColor: palette.accent },
  pillText: { color: palette.muted, fontSize: 14, fontWeight: '600' },
  pillTextActive: { color: palette.onAccent },

  photoRow: { gap: Spacing.two, paddingVertical: Spacing.one },
  photoThumb: { width: 88, height: 88, borderRadius: Radius.md, overflow: 'hidden' },
  photoImg: { width: '100%', height: '100%' },
  removePhoto: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: Radius.full,
    backgroundColor: '#000000cc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhoto: {
    width: 88,
    height: 88,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    borderStyle: 'dashed',
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  addPhotoText: { color: palette.accent, fontSize: 12, fontWeight: '600' },

  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two, marginBottom: Spacing.two },
  stepNum: {
    width: 26,
    height: 26,
    borderRadius: Radius.full,
    backgroundColor: palette.surface2,
    borderColor: palette.border,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.three,
  },
  stepNumText: { color: palette.fg, fontSize: 13, fontWeight: '700' },
  stepInput: { flex: 1 },
  removeStep: { paddingTop: Spacing.three + 2 },
  addStep: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.three,
    borderRadius: Radius.md,
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderWidth: 1,
    marginTop: Spacing.one,
  },
  addStepText: { color: palette.accent, fontSize: 14, fontWeight: '700' },
  tipInput: { minHeight: 70, textAlignVertical: 'top' },
});
