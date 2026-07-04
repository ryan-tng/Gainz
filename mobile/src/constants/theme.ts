/**
 * Gainz app theme — dark, athletic, lime/emerald accent, matching the waitlist
 * landing page. The app is dark-only for now (a strong single look).
 */
import { Platform } from 'react-native';

export const palette = {
  bg: '#08090b',
  surface: '#101216',
  surface2: '#171a20',
  border: '#23272f',
  fg: '#f4f6f8',
  muted: '#98a1af',
  accent: '#a3e635',
  accent2: '#34d399',
  danger: '#f87171',
  onAccent: '#08090b',
} as const;

// Kept for compatibility with any leftover template references.
export const Colors = {
  light: {
    text: palette.fg,
    background: palette.bg,
    backgroundElement: palette.surface,
    backgroundSelected: palette.surface2,
    textSecondary: palette.muted,
  },
  dark: {
    text: palette.fg,
    background: palette.bg,
    backgroundElement: palette.surface,
    backgroundSelected: palette.surface2,
    textSecondary: palette.muted,
  },
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 12,
  four: 16,
  five: 24,
  six: 32,
  eight: 48,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

export const Fonts = Platform.select({
  ios: { sans: 'system-ui', rounded: 'ui-rounded', mono: 'ui-monospace' },
  default: { sans: 'normal', rounded: 'normal', mono: 'monospace' },
});
