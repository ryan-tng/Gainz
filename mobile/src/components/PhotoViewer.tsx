import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius, Spacing } from '@/constants/theme';

export interface OriginRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Full-screen photo viewer with a Snapchat/Instagram-style transition: the
 * photo zooms out of the tile it was opened from and shrinks back into it on
 * close. Tap anywhere or swipe down to close.
 */
export function PhotoViewer({
  url,
  origin,
  title,
  onReport,
  onClosed,
}: {
  url: string;
  origin: OriginRect | null;
  title: string;
  onReport?: () => void;
  onClosed: () => void;
}) {
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current; // 0 = at tile, 1 = full screen
  const dragY = useRef(new Animated.Value(0)).current;
  const [loading, setLoading] = useState(true);
  const closing = useRef(false);

  useEffect(() => {
    Animated.spring(progress, {
      toValue: 1,
      useNativeDriver: true,
      stiffness: 260,
      damping: 26,
      mass: 0.9,
    }).start();
  }, [progress]);

  const close = (after?: () => void) => {
    if (closing.current) return;
    closing.current = true;
    Animated.parallel([
      Animated.timing(progress, { toValue: 0, duration: 220, useNativeDriver: true }),
      Animated.timing(dragY, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(() => {
      onClosed();
      after?.();
    });
  };

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6,
        onPanResponderMove: (_, g) => dragY.setValue(Math.max(0, g.dy)),
        onPanResponderRelease: (_, g) => {
          const tap = Math.abs(g.dx) < 6 && Math.abs(g.dy) < 6;
          if (tap || g.dy > 120 || g.vy > 1) close();
          else Animated.spring(dragY, { toValue: 0, useNativeDriver: true }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(dragY, { toValue: 0, useNativeDriver: true }).start();
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Start/end at the tile: same center and the tile's width.
  const fromScale = origin ? Math.max(0.08, origin.width / W) : 0.9;
  const fromX = origin ? origin.x + origin.width / 2 - W / 2 : 0;
  const fromY = origin ? origin.y + origin.height / 2 - H / 2 : 0;

  const scale = Animated.multiply(
    progress.interpolate({ inputRange: [0, 1], outputRange: [fromScale, 1] }),
    dragY.interpolate({ inputRange: [0, 400], outputRange: [1, 0.8], extrapolate: 'clamp' }),
  );
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [fromX, 0] });
  const translateY = Animated.add(
    progress.interpolate({ inputRange: [0, 1], outputRange: [fromY, 0] }),
    dragY,
  );
  const contentOpacity = progress.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 1, 1] });
  const backdropOpacity = Animated.multiply(
    progress,
    dragY.interpolate({ inputRange: [0, 400], outputRange: [1, 0.3], extrapolate: 'clamp' }),
  );
  const chromeOpacity = Animated.multiply(
    progress.interpolate({ inputRange: [0.6, 1], outputRange: [0, 1], extrapolate: 'clamp' }),
    dragY.interpolate({ inputRange: [0, 80], outputRange: [1, 0], extrapolate: 'clamp' }),
  );

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={() => close()}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdropOpacity }]} />
      <Animated.View
        {...pan.panHandlers}
        accessible
        accessibilityRole="button"
        accessibilityLabel={`${title}. Tap to close`}
        style={[
          StyleSheet.absoluteFill,
          styles.center,
          { opacity: contentOpacity, transform: [{ translateX }, { translateY }, { scale }] },
        ]}>
        <Image
          source={{ uri: url }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onLoadEnd={() => setLoading(false)}
        />
        {loading ? <ActivityIndicator color="#f4f6f8" size="large" /> : null}
      </Animated.View>

      <Animated.View
        pointerEvents="box-none"
        style={[styles.top, { top: insets.top + Spacing.two, opacity: chromeOpacity }]}>
        <View style={styles.pill} pointerEvents="none">
          <Text style={styles.pillText}>{title}</Text>
        </View>
        {onReport ? (
          <Pressable onPress={() => close(onReport)} style={styles.pill} accessibilityRole="button" hitSlop={6}>
            <Text style={styles.pillText}>Report</Text>
          </Pressable>
        ) : null}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: '#000' },
  center: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  top: {
    position: 'absolute',
    left: Spacing.four,
    right: Spacing.four,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pill: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
  },
  pillText: { color: '#f4f6f8', fontSize: 14, fontWeight: '600' },
});
