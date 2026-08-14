import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/ui';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { confirmAsync } from '@/lib/confirm';
import { lookupBarcode } from '@/lib/foodDb';
import { useTheme, useThemedStyles } from '@/store/theme';

export default function BarcodeScreen() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const handledRef = useRef(false);

  const onScan = async ({ data }: { data: string }) => {
    if (handledRef.current) return;
    handledRef.current = true;
    setBusy(true);
    try {
      const item = await lookupBarcode(data);
      if (!item) {
        const again = await confirmAsync({
          title: 'Not found',
          message: `No product for barcode ${data}. Try searching by name instead.`,
          confirmText: 'Scan again',
          cancelText: 'Back',
        });
        if (again) {
          handledRef.current = false;
          setBusy(false);
        } else {
          router.back();
        }
        return;
      }
      router.replace({
        pathname: '/nutrition/add',
        params: {
          label: item.brand ? `${item.name} (${item.brand})` : item.name,
          calories: String(item.calories),
          protein: String(item.protein_g),
          carbs: String(item.carbs_g),
          fat: String(item.fat_g),
        },
      });
    } catch {
      const again = await confirmAsync({
        title: 'Lookup failed',
        message: 'Please try again.',
        confirmText: 'Scan again',
        cancelText: 'Back',
      });
      if (again) {
        handledRef.current = false;
        setBusy(false);
      } else {
        router.back();
      }
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={16} style={styles.side}>
          <Ionicons name="close" size={26} color={palette.fg} />
        </Pressable>
        <Text style={styles.topTitle}>Scan barcode</Text>
        <View style={styles.side} />
      </View>

      {!permission ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.accent} />
        </View>
      ) : !permission.granted ? (
        <View style={styles.center}>
          <Ionicons name="camera-outline" size={40} color={palette.muted} />
          <Text style={styles.msg}>Camera access is needed to scan barcodes.</Text>
          <AppButton label="Allow camera" icon="camera" onPress={requestPermission} />
        </View>
      ) : (
        <View style={styles.cameraWrap}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128'],
            }}
            onBarcodeScanned={busy ? undefined : onScan}
          />
          <View style={styles.overlay} pointerEvents="none">
            <View style={[styles.frame, { borderColor: palette.accent }]} />
            <Text style={styles.hint}>
              {busy ? 'Looking up…' : 'Point at a product barcode'}
            </Text>
          </View>
        </View>
      )}
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
    },
    side: { minWidth: 40 },
    topTitle: { color: palette.fg, fontSize: 17, fontWeight: '700' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three, padding: Spacing.five },
    msg: { color: palette.muted, fontSize: 15, textAlign: 'center', maxWidth: 280, lineHeight: 21 },
    cameraWrap: { flex: 1, overflow: 'hidden' },
    overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: Spacing.four },
    frame: {
      width: 260,
      height: 160,
      borderWidth: 3,
      borderRadius: Radius.lg,
    },
    hint: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '700',
      backgroundColor: '#000000aa',
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two,
      borderRadius: Radius.full,
      overflow: 'hidden',
    },
  });
