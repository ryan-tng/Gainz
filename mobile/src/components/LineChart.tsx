import { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/store/theme';

/**
 * Minimal responsive line chart. Give it a series of numeric `values`
 * (chronological) and it draws a themed trend line with endpoint dots.
 */
export function LineChart({
  values,
  height = 150,
  color,
  labels,
}: {
  values: number[];
  height?: number;
  color?: string;
  /** Optional [start, end] labels shown under the chart. */
  labels?: [string, string];
}) {
  const { palette } = useTheme();
  const c = color ?? palette.accent;
  const [width, setWidth] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const padY = 12;
  const plotH = height - padY * 2;

  const xFor = (i: number) => (values.length <= 1 ? width / 2 : (i / (values.length - 1)) * width);
  const yFor = (v: number) => padY + (1 - (v - min) / range) * plotH;

  const pointsStr = values.map((v, i) => `${xFor(i)},${yFor(v)}`).join(' ');

  return (
    <View>
      <View style={{ height }} onLayout={onLayout}>
        {width > 0 ? (
          <Svg width={width} height={height}>
            {/* baseline */}
            <Line x1={0} y1={height - padY} x2={width} y2={height - padY} stroke={palette.border} strokeWidth={1} />
            {values.length > 1 ? (
              <Polyline
                points={pointsStr}
                fill="none"
                stroke={c}
                strokeWidth={2.5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ) : null}
            {values.map((v, i) => (
              <Circle
                key={i}
                cx={xFor(i)}
                cy={yFor(v)}
                r={i === values.length - 1 ? 4.5 : 2.5}
                fill={i === values.length - 1 ? c : palette.surface}
                stroke={c}
                strokeWidth={2}
              />
            ))}
          </Svg>
        ) : null}
      </View>
      {labels ? (
        <View style={styles.labelsRow}>
          <Text style={[styles.label, { color: palette.muted }]}>{labels[0]}</Text>
          <Text style={[styles.label, { color: palette.muted }]}>{labels[1]}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  labelsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.two },
  label: { fontSize: 11, fontWeight: '600' },
});
