import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Alert,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, EmptyState } from '@/components/ui';
import { palette, Radius, Spacing } from '@/constants/theme';
import { useMachines } from '@/store/machines';

const { width } = Dimensions.get('window');
const PHOTO_W = width - Spacing.four * 2;

export default function MachineDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { getMachine, deleteMachine } = useMachines();
  const machine = getMachine(id);

  if (!machine) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <TopBar onBack={() => router.back()} />
        <EmptyState icon="alert-circle-outline" title="Machine not found" body="It may have been deleted." />
      </SafeAreaView>
    );
  }

  const onDelete = () => {
    Alert.alert('Delete machine?', `Remove "${machine.name}" and its tutorial?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteMachine(machine.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <TopBar
        onBack={() => router.back()}
        onEdit={() => router.push(`/machine/edit?id=${machine.id}`)}
        onDelete={onDelete}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {machine.photos.length > 0 ? (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={styles.gallery}>
            {machine.photos.map((uri, i) => (
              <Image key={i} source={{ uri }} style={styles.photo} />
            ))}
          </ScrollView>
        ) : (
          <View style={styles.noPhoto}>
            <Ionicons name="camera-outline" size={32} color={palette.muted} />
            <Text style={styles.noPhotoText}>No photos yet</Text>
          </View>
        )}

        <View style={styles.titleRow}>
          <Text style={styles.name}>{machine.name}</Text>
          <View style={styles.musclePill}>
            <Text style={styles.musclePillText}>{machine.muscle}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>How to use it</Text>
        {machine.steps.length === 0 ? (
          <Text style={styles.emptyText}>No steps added yet.</Text>
        ) : (
          machine.steps.map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={styles.stepNum}>
                <Text style={styles.stepNumText}>{i + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))
        )}

        {machine.tip ? (
          <View style={styles.tipCard}>
            <Ionicons name="bulb-outline" size={18} color={palette.accent} />
            <Text style={styles.tipText}>{machine.tip}</Text>
          </View>
        ) : null}

        <AppButton
          label="Edit tutorial"
          icon="create-outline"
          variant="secondary"
          onPress={() => router.push(`/machine/edit?id=${machine.id}`)}
          style={{ marginTop: Spacing.five }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function TopBar({
  onBack,
  onEdit,
  onDelete,
}: {
  onBack: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <View style={styles.topBar}>
      <Pressable onPress={onBack} hitSlop={10}>
        <Ionicons name="chevron-back" size={26} color={palette.fg} />
      </Pressable>
      <View style={styles.topActions}>
        {onEdit ? (
          <Pressable onPress={onEdit} hitSlop={10}>
            <Ionicons name="create-outline" size={22} color={palette.fg} />
          </Pressable>
        ) : null}
        {onDelete ? (
          <Pressable onPress={onDelete} hitSlop={10}>
            <Ionicons name="trash-outline" size={22} color={palette.danger} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  topActions: { flexDirection: 'row', gap: Spacing.four },
  content: { padding: Spacing.four, paddingBottom: Spacing.eight, gap: Spacing.three },
  gallery: { marginHorizontal: -Spacing.four },
  photo: { width, height: PHOTO_W * 0.72, resizeMode: 'cover' },
  noPhoto: {
    height: 160,
    borderRadius: Radius.lg,
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  noPhotoText: { color: palette.muted, fontSize: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, marginTop: Spacing.two },
  name: { color: palette.fg, fontSize: 26, fontWeight: '800', letterSpacing: -0.5, flexShrink: 1 },
  musclePill: {
    backgroundColor: palette.surface2,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  musclePillText: { color: palette.muted, fontSize: 13, fontWeight: '600' },
  sectionTitle: { color: palette.fg, fontSize: 18, fontWeight: '700', marginTop: Spacing.three },
  emptyText: { color: palette.muted, fontSize: 14 },
  stepRow: { flexDirection: 'row', gap: Spacing.three, alignItems: 'flex-start' },
  stepNum: {
    width: 26,
    height: 26,
    borderRadius: Radius.full,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumText: { color: palette.onAccent, fontSize: 13, fontWeight: '800' },
  stepText: { flex: 1, color: palette.fg, fontSize: 15, lineHeight: 22 },
  tipCard: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'flex-start',
    backgroundColor: palette.surface,
    borderColor: palette.accent,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.three,
    marginTop: Spacing.three,
  },
  tipText: { flex: 1, color: palette.fg, fontSize: 14, lineHeight: 20 },
});
