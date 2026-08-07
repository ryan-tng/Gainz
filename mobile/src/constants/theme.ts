/**
 * Gainz app theme. The app ships a dark and a light palette; the active one is
 * resolved at runtime by the ThemeProvider (see src/store/theme.tsx), which also
 * applies the user's chosen accent color. Components read the live palette via
 * `useTheme()` and build their styles with a `makeStyles(palette)` factory.
 */
import { Platform } from 'react-native';

export interface Palette {
  bg: string;
  surface: string;
  surface2: string;
  border: string;
  fg: string;
  muted: string;
  accent: string;
  accent2: string;
  danger: string;
  onAccent: string;
}

export const darkPalette: Palette = {
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
};

export const lightPalette: Palette = {
  bg: '#f6f7f9',
  surface: '#ffffff',
  surface2: '#eceef2',
  border: '#dfe3e9',
  fg: '#0d0f12',
  muted: '#5b6472',
  accent: '#4d7c0f', // deeper lime so it reads on white as fill *and* text
  accent2: '#0f9d6b',
  danger: '#dc2626',
  onAccent: '#ffffff',
};

/** Accent colors the user can pick in Settings. */
export const ACCENTS = [
  '#a3e635', // lime (default)
  '#34d399', // emerald
  '#22d3ee', // cyan
  '#60a5fa', // blue
  '#a78bfa', // violet
  '#f472b6', // pink
  '#fb923c', // orange
  '#f87171', // red
] as const;

/** Blend two hex colors: t=0 → a, t=1 → b. */
export function mixHex(a: string, b: string, t: number): string {
  const pa = a.replace('#', '');
  const pb = b.replace('#', '');
  const ar = parseInt(pa.slice(0, 2), 16);
  const ag = parseInt(pa.slice(2, 4), 16);
  const ab = parseInt(pa.slice(4, 6), 16);
  const br = parseInt(pb.slice(0, 2), 16);
  const bg = parseInt(pb.slice(2, 4), 16);
  const bb = parseInt(pb.slice(4, 6), 16);
  const h = (n: number) => Math.round(n).toString(16).padStart(2, '0');
  return `#${h(ar + (br - ar) * t)}${h(ag + (bg - ag) * t)}${h(ab + (bb - ab) * t)}`;
}

// ---------- Home background ----------

export type AppBackground =
  | { type: 'none' }
  | { type: 'gradient'; id: string }
  | { type: 'image'; uri: string; dim?: number }; // dim: 0 (raw) … 1 (solid overlay)

/** Gradient presets, computed from the live palette so they suit dark & light. */
export interface GradientPreset {
  id: string;
  label: string;
  colors: (p: Palette) => string[];
}

export const GRADIENTS: GradientPreset[] = [
  { id: 'accent', label: 'Accent glow', colors: (p) => [mixHex(p.bg, p.accent, 0.22), p.bg] },
  { id: 'emerald', label: 'Emerald', colors: (p) => [mixHex(p.bg, p.accent2, 0.2), p.bg] },
  { id: 'twilight', label: 'Twilight', colors: (p) => [mixHex(p.bg, '#a78bfa', 0.22), p.bg] },
  { id: 'sunset', label: 'Sunset', colors: (p) => [mixHex(p.bg, '#fb923c', 0.2), p.bg] },
  { id: 'ocean', label: 'Ocean', colors: (p) => [mixHex(p.bg, '#22d3ee', 0.2), p.bg] },
  { id: 'charcoal', label: 'Charcoal', colors: (p) => [p.surface2, p.bg] },
];

/** Pick black/white text for a given accent background by luminance. */
export function contrastOn(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  // Perceived luminance (sRGB approximation).
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#08090b' : '#ffffff';
}

/** Default/fallback palette (dark). Used until the ThemeProvider mounts. */
export const palette: Palette = darkPalette;

// Kept for compatibility with any leftover template references.
export const Colors = {
  light: {
    text: lightPalette.fg,
    background: lightPalette.bg,
    backgroundElement: lightPalette.surface,
    backgroundSelected: lightPalette.surface2,
    textSecondary: lightPalette.muted,
  },
  dark: {
    text: darkPalette.fg,
    background: darkPalette.bg,
    backgroundElement: darkPalette.surface,
    backgroundSelected: darkPalette.surface2,
    textSecondary: darkPalette.muted,
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
