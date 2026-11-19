import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import type { Streak } from '@/lib/social';
import { useTheme } from '@/store/theme';

/** Streak state colors, tuned per theme so they keep contrast on light backgrounds. */
export function useStreakColors() {
  const { isDark, palette } = useTheme();
  return {
    flame: isDark ? '#fb923c' : '#c2410c',
    risk: isDark ? '#fbbf24' : '#a16207',
    lost: palette.muted,
  };
}

export type StreakState = 'pending' | 'ok' | 'risk' | 'lost';

export function streakState(s: Streak): StreakState {
  if (s.lost) return 'lost';
  if (!s.progress) return 'pending';
  return s.progress.atRisk ? 'risk' : 'ok';
}

/**
 * The Snapchat-style streak number: orange flame + weeks in a row, amber
 * hourglass when the week is about to end with someone behind, gray flame +
 * "Lost at N" once it's over.
 */
export function StreakBadge({ streak, size = 16 }: { streak: Streak; size?: number }) {
  const c = useStreakColors();
  const state = streakState(streak);
  if (state === 'pending') return null;
  if (state === 'lost') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Ionicons name="flame" size={size} color={c.lost} />
        <Text style={{ color: c.lost, fontSize: size * 0.85, fontWeight: '700' }}>
          Lost at {streak.lost_at_count ?? 0}
        </Text>
      </View>
    );
  }
  const color = state === 'risk' ? c.risk : c.flame;
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
      accessibilityLabel={`${streak.progress!.consecutive}-week streak${state === 'risk' ? ', at risk' : ''}`}>
      <Ionicons name={state === 'risk' ? 'hourglass' : 'flame'} size={size} color={color} />
      <Text style={{ color, fontSize: size, fontWeight: '800' }}>{streak.progress!.consecutive}</Text>
    </View>
  );
}

/**
 * One segment per workout in the weekly target. `preview` fills the next
 * segment faintly (the workout you're about to count). Targets above 7 fall
 * back to a continuous bar so segments don't get too thin.
 */
export function SegmentBar({
  count,
  target,
  preview = false,
  color,
  height = 6,
}: {
  count: number;
  target: number;
  preview?: boolean;
  color?: string;
  height?: number;
}) {
  const { palette } = useTheme();
  const fill = color ?? palette.accent;
  const empty = palette.border;
  if (target > 7) {
    const pct = Math.min(1, (count + (preview ? 1 : 0)) / target);
    return (
      <View style={{ height, borderRadius: height, backgroundColor: empty, overflow: 'hidden' }}>
        <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: fill, opacity: preview ? 0.85 : 1 }} />
      </View>
    );
  }
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {Array.from({ length: target }, (_, i) => {
        const done = i < count;
        const ghost = !done && preview && i === count;
        return (
          <View
            key={i}
            style={{
              flex: 1,
              height,
              borderRadius: height,
              backgroundColor: done || ghost ? fill : empty,
              opacity: ghost ? 0.4 : 1,
            }}
          />
        );
      })}
    </View>
  );
}

const AVATAR_COLORS = ['#60a5fa', '#f472b6', '#fb923c', '#a78bfa', '#34d399', '#22d3ee', '#f87171'];

/** Colored circle with the friend's first letter (stable color per username). */
export function InitialAvatar({ name, size = 40, dim = false }: { name: string; size?: number; dim?: boolean }) {
  const { palette } = useTheme();
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const bg = dim ? palette.surface2 : AVATAR_COLORS[h % AVATAR_COLORS.length];
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text style={{ color: dim ? palette.muted : '#08090b', fontSize: size * 0.4, fontWeight: '800' }}>
        {(name[0] ?? '?').toUpperCase()}
      </Text>
    </View>
  );
}
