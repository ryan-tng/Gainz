import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius, Spacing } from '@/constants/theme';
import { useRestTimer } from '@/store/restTimer';
import { useTheme } from '@/store/theme';

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Floating rest timer — counts down, then rings until dismissed. App-wide. */
export function RestTimerBar() {
  const { running, alarming, endsAt, addTime, skip, stopAlarm } = useRestTimer();
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const [now, setNow] = useState(Date.now());

  // Tick locally (only this component re-renders) while counting down.
  useEffect(() => {
    if (endsAt === null) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [endsAt]);

  if (!running && !alarming) return null;

  const remaining = endsAt === null ? 0 : Math.max(0, Math.ceil((endsAt - now) / 1000));

  if (alarming) {
    return (
      <View style={[styles.wrap, { bottom: insets.bottom + 72, pointerEvents: 'box-none' }]}>
        <View
          style={[styles.bar, { backgroundColor: palette.accent, borderColor: palette.accent, pointerEvents: 'box-none' }]}>
          <View style={styles.left}>
            <Ionicons name="alarm" size={20} color={palette.onAccent} />
            <Text style={[styles.ringLabel, { color: palette.onAccent }]}>Rest over</Text>
          </View>
          <Pressable
            onPress={stopAlarm}
            hitSlop={8}
            style={[styles.stop, { backgroundColor: palette.onAccent }]}>
            <Text style={[styles.stopText, { color: palette.accent }]}>Stop</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { bottom: insets.bottom + 72, pointerEvents: 'box-none' }]}>
      <View
        style={[styles.bar, { backgroundColor: palette.surface, borderColor: palette.border, pointerEvents: 'box-none' }]}>
        <View style={styles.left}>
          <Ionicons name="timer-outline" size={18} color={palette.accent} />
          <Text style={[styles.label, { color: palette.muted }]}>Rest</Text>
          <Text style={[styles.time, { color: palette.fg }]}>{fmt(remaining)}</Text>
        </View>
        <View style={styles.actions}>
          <Pressable onPress={() => addTime(-15)} hitSlop={8} style={styles.adj}>
            <Text style={[styles.adjText, { color: palette.fg }]}>−15</Text>
          </Pressable>
          <Pressable onPress={() => addTime(15)} hitSlop={8} style={styles.adj}>
            <Text style={[styles.adjText, { color: palette.fg }]}>+15</Text>
          </Pressable>
          <Pressable onPress={skip} hitSlop={8} style={[styles.skip, { backgroundColor: palette.accent }]}>
            <Text style={[styles.skipText, { color: palette.onAccent }]}>Skip</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: Spacing.four, right: Spacing.four },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.two + 2,
    paddingHorizontal: Spacing.three,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  label: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  time: { fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'], minWidth: 48 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  adj: { paddingHorizontal: Spacing.two, paddingVertical: Spacing.one },
  adjText: { fontSize: 14, fontWeight: '700' },
  skip: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.one + 2, borderRadius: Radius.full },
  skipText: { fontSize: 13, fontWeight: '800' },
  ringLabel: { fontSize: 16, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  stop: { paddingHorizontal: Spacing.five, paddingVertical: Spacing.two, borderRadius: Radius.full },
  stopText: { fontSize: 15, fontWeight: '800' },
});
