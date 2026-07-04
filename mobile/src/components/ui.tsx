import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { palette, Radius, Spacing } from '@/constants/theme';

export function AppButton({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const bg =
    variant === 'primary'
      ? palette.accent
      : variant === 'secondary'
        ? palette.surface2
        : 'transparent';
  const fg =
    variant === 'primary'
      ? palette.onAccent
      : variant === 'danger'
        ? palette.danger
        : palette.fg;
  const border = variant === 'secondary' ? palette.border : 'transparent';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}>
      {icon && <Ionicons name={icon} size={18} color={fg} />}
      <Text style={[styles.btnLabel, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function ScreenHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>{title}</Text>
      {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  body,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={28} color={palette.muted} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

export function Loading() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={palette.accent} />
    </View>
  );
}

export function Pill({ label, active }: { label: string; active?: boolean }) {
  return (
    <View
      style={[
        styles.pill,
        active && { backgroundColor: palette.accent, borderColor: palette.accent },
      ]}>
      <Text style={[styles.pillText, active && { color: palette.onAccent }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three + 2,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  btnLabel: { fontSize: 16, fontWeight: '700' },
  card: {
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.four,
  },
  header: { paddingBottom: Spacing.four, gap: Spacing.one },
  headerTitle: { color: palette.fg, fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  headerSubtitle: { color: palette.muted, fontSize: 15 },
  empty: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.eight },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: Radius.full,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  emptyTitle: { color: palette.fg, fontSize: 17, fontWeight: '700' },
  emptyBody: {
    color: palette.muted,
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 20,
  },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pill: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  pillText: { color: palette.muted, fontSize: 13, fontWeight: '600' },
});
