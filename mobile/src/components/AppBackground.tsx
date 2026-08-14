import { LinearGradient } from 'expo-linear-gradient';
import { Image, StyleSheet, View } from 'react-native';

import { GRADIENTS } from '@/constants/theme';
import { usableImageUri } from '@/lib/images';
import { useTheme } from '@/store/theme';

/**
 * Absolute-fill background layer for a screen. Always paints an opaque base
 * (so it fully covers during card transitions even when set to "None"), then
 * the user's chosen gradient or photo on top. Render it as the FIRST child of a
 * screen whose root background is transparent, so content paints over it.
 */
export function AppBackground() {
  const { background, palette } = useTheme();

  return (
    <View
      style={[StyleSheet.absoluteFill, { backgroundColor: palette.bg }]}
      pointerEvents="none">
      {background.type === 'gradient'
        ? (() => {
            const preset = GRADIENTS.find((g) => g.id === background.id);
            if (!preset) return null;
            return (
              <LinearGradient
                colors={preset.colors(palette) as [string, string, ...string[]]}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
            );
          })()
        : null}

      {background.type === 'image' && usableImageUri(background.uri) ? (
        <>
          <Image
            source={{ uri: usableImageUri(background.uri) }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
          {/* Optional readability dim, controlled by the slider in Settings. */}
          {background.dim ? (
            <View
              style={[StyleSheet.absoluteFill, { backgroundColor: palette.bg, opacity: background.dim }]}
            />
          ) : null}
        </>
      ) : null}
    </View>
  );
}
