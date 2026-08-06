import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme } from 'react-native';

import {
  ACCENTS,
  contrastOn,
  darkPalette,
  lightPalette,
  type Palette,
} from '@/constants/theme';
import { storage } from '@/lib/storage';

export type ThemeMode = 'dark' | 'light' | 'system';

export interface ThemePrefs {
  mode: ThemeMode;
  accent: string;
}

const DEFAULT_PREFS: ThemePrefs = { mode: 'dark', accent: ACCENTS[0] };

interface ThemeContextValue {
  loaded: boolean;
  /** The resolved, live palette (base + user accent). */
  palette: Palette;
  /** True when the effective scheme is dark (after resolving 'system'). */
  isDark: boolean;
  mode: ThemeMode;
  accent: string;
  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme(); // 'light' | 'dark' | null
  const [loaded, setLoaded] = useState(false);
  const [prefs, setPrefs] = useState<ThemePrefs>(DEFAULT_PREFS);

  useEffect(() => {
    (async () => {
      const saved = await storage.loadTheme();
      if (saved) setPrefs({ ...DEFAULT_PREFS, ...saved });
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (loaded) void storage.saveTheme(prefs);
  }, [prefs, loaded]);

  const value = useMemo<ThemeContextValue>(() => {
    const isDark = prefs.mode === 'system' ? system !== 'light' : prefs.mode === 'dark';
    const base = isDark ? darkPalette : lightPalette;
    const palette: Palette = {
      ...base,
      accent: prefs.accent,
      onAccent: contrastOn(prefs.accent),
    };
    return {
      loaded,
      palette,
      isDark,
      mode: prefs.mode,
      accent: prefs.accent,
      setMode: (mode) => setPrefs((p) => ({ ...p, mode })),
      setAccent: (accent) => setPrefs((p) => ({ ...p, accent })),
    };
  }, [loaded, prefs, system]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}

/** Build memoized styles from the live palette: `const styles = useThemedStyles(makeStyles)`. */
export function useThemedStyles<T>(factory: (palette: Palette) => T): T {
  const { palette } = useTheme();
  return useMemo(() => factory(palette), [factory, palette]);
}
