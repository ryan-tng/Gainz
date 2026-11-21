import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { notify } from '@/lib/confirm';
import { checkInWithPhoto, refreshStreakReminders } from '@/lib/social';
import { PHOTO_WINDOW_MS, removePendingPhotos, timeLeftLabel } from '@/lib/streakPending';
import { useTheme } from '@/store/theme';

/**
 * Proof photo for photo streaks. Camera only: there is deliberately no way to
 * pick from the photo library. The shot must be sent within 2 hours of the
 * workout finishing (self-reported; a nudge, not verification).
 */
export default function StreakPhotoScreen() {
  const router = useRouter();
  const { palette } = useTheme();
  const params = useLocalSearchParams<{ ids?: string; label?: string; finishedAt?: string; to?: string }>();
  const ids = (params.ids ?? '').split(',').filter(Boolean);
  const finishedAt = Number(params.finishedAt) || Date.now();
  const label = params.label || null;

  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const camRef = useRef<CameraView>(null);
  const [facing, setFacing] = useState<CameraType>('front');
  const [ready, setReady] = useState(false);
  const [pictureSize, setPictureSize] = useState<string | undefined>(undefined);
  const [shot, setShot] = useState<{ uri: string; base64: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const expired = Date.now() - finishedAt > PHOTO_WINDOW_MS;

  // Keep uploads small: prefer a ~1080p capture size when the device offers one.
  const onReady = async () => {
    setReady(true);
    try {
      const sizes = (await camRef.current?.getAvailablePictureSizesAsync()) ?? [];
      const pick = ['1920x1080', '1280x720', 'High', 'Medium'].find((s) => sizes.includes(s));
      if (pick) setPictureSize(pick);
    } catch {
      // default size is fine
    }
  };

  const capture = async () => {
    if (!camRef.current || !ready || busy) return;
    try {
      const pic = await camRef.current.takePictureAsync({ quality: 0.5, base64: true, shutterSound: false });
      if (pic?.base64) setShot({ uri: pic.uri, base64: pic.base64 });
    } catch {
      notify('Could not take photo', 'Please try again.');
    }
  };

  const send = async () => {
    if (!shot || busy) return;
    if (Date.now() - finishedAt > PHOTO_WINDOW_MS) {
      await removePendingPhotos(ids);
      notify('Too late for this workout', 'Proof photos have to be sent within 2 hours of finishing.');
      router.back();
      return;
    }
    setBusy(true);
    try {
      const { counted, failed } = await checkInWithPhoto(ids, label, shot.base64);
      await removePendingPhotos(counted);
      void refreshStreakReminders(); // clears the photo reminder, updates "ends soon"
      if (failed.length === 0) {
        notify('Sent', counted.length === 1 ? 'Your streak is counted.' : `${counted.length} streaks counted.`);
        router.back();
      } else {
        notify(
          'Some streaks didn’t go through',
          `${counted.length} counted, ${failed.length} failed. Check your connection and try again.`,
        );
      }
    } catch (e) {
      notify('Could not send photo', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (!permission) {
    return <View style={[styles.fill, { backgroundColor: '#000' }]} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.fill, styles.center, { backgroundColor: palette.bg, padding: Spacing.six }]}>
        <Ionicons name="camera-outline" size={44} color={palette.accent} />
        <Text style={[styles.permTitle, { color: palette.fg }]}>Camera needed for photo streaks</Text>
        <Text style={[styles.permBody, { color: palette.muted }]}>
          Proof photos are taken in the app so they’re from right now, not your camera roll.
        </Text>
        <AppButton label="Allow camera" icon="camera" onPress={requestPermission} style={{ marginTop: Spacing.five, alignSelf: 'stretch' }} />
        <Pressable onPress={() => router.back()} style={styles.permLater} accessibilityRole="button">
          <Text style={{ color: palette.muted, fontSize: 15, fontWeight: '600' }}>Later</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <View style={[styles.fill, { backgroundColor: '#000' }]}>
      <View style={styles.viewfinder}>
        {shot ? (
          <Image source={{ uri: shot.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <CameraView
            ref={camRef}
            style={StyleSheet.absoluteFill}
            facing={facing}
            mirror={facing === 'front'}
            pictureSize={pictureSize}
            onCameraReady={onReady}
          />
        )}

        {/* Positioned from the device insets: SafeAreaView inside a full-screen
            modal can measure 0 and slide this under the status bar. */}
        <View style={[styles.topBar, { top: insets.top + Spacing.two }]} pointerEvents="box-none">
          <Pressable onPress={() => router.back()} style={styles.pill} accessibilityRole="button" hitSlop={6}>
            <Text style={styles.pillText}>Later</Text>
          </Pressable>
          <View style={[styles.pill, { flexShrink: 1 }]}>
            <Text style={styles.pillText} numberOfLines={1}>
              Sending to {params.to || 'your streak'}
            </Text>
          </View>
        </View>

        <View style={styles.hintWrap} pointerEvents="none">
          <View style={styles.pill}>
            <Text style={[styles.pillText, { fontWeight: '500' }]}>
              {expired ? 'The 2-hour window has closed' : `Keep other people out of frame · ${timeLeftLabel(finishedAt)}`}
            </Text>
          </View>
        </View>
      </View>

      <View style={[styles.controls, { paddingBottom: Math.max(insets.bottom, Spacing.four) }]}>
        {shot ? (
          <View style={styles.reviewRow}>
            <AppButton label="Retake" icon="refresh" variant="secondary" onPress={() => setShot(null)} disabled={busy} style={{ flex: 1 }} />
            <AppButton
              label={busy ? 'Sending…' : 'Send'}
              icon="paper-plane"
              onPress={send}
              disabled={busy || expired}
              style={{ flex: 1 }}
            />
          </View>
        ) : (
          <View style={styles.shutterRow}>
            <View style={styles.sideSlot} />
            <Pressable
              onPress={capture}
              disabled={!ready || expired}
              accessibilityRole="button"
              accessibilityLabel="Take photo"
              style={({ pressed }) => [styles.shutter, { opacity: !ready || expired ? 0.4 : pressed ? 0.8 : 1 }]}>
              <View style={styles.shutterInner} />
            </Pressable>
            <Pressable
              onPress={() => setFacing((f) => (f === 'front' ? 'back' : 'front'))}
              accessibilityRole="button"
              accessibilityLabel="Flip camera"
              style={styles.flip}>
              <Ionicons name="camera-reverse-outline" size={24} color="#f4f6f8" />
            </Pressable>
          </View>
        )}
        {busy ? <ActivityIndicator color="#f4f6f8" style={{ marginTop: Spacing.two }} /> : null}
        <Text style={styles.footnote}>Camera only. Photos from your library can’t be used.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  viewfinder: {
    flex: 1,
    backgroundColor: '#16191e',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  topBar: {
    position: 'absolute',
    left: Spacing.four,
    right: Spacing.four,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  pill: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
  },
  pillText: { color: '#f4f6f8', fontSize: 14, fontWeight: '600' },
  hintWrap: { position: 'absolute', bottom: Spacing.five, left: 0, right: 0, alignItems: 'center' },
  controls: { paddingTop: Spacing.five, paddingHorizontal: Spacing.six, alignItems: 'center' },
  shutterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', alignSelf: 'stretch' },
  sideSlot: { width: 52, height: 52 },
  shutter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#f4f6f8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#f4f6f8' },
  flip: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#1d2027', alignItems: 'center', justifyContent: 'center' },
  reviewRow: { flexDirection: 'row', gap: Spacing.two, alignSelf: 'stretch' },
  footnote: { color: '#98a1af', fontSize: 13, textAlign: 'center', marginTop: Spacing.four },
  permTitle: { fontSize: 20, fontWeight: '800', marginTop: Spacing.four, textAlign: 'center' },
  permBody: { fontSize: 14, lineHeight: 20, marginTop: Spacing.two, textAlign: 'center' },
  permLater: { minHeight: 44, justifyContent: 'center', marginTop: Spacing.two },
});
