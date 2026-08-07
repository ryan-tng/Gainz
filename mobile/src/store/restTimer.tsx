import * as Haptics from 'expo-haptics';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { storage } from '@/lib/storage';

const DEFAULT_REST = 90;

interface RestTimerContextValue {
  /** User's default rest length, in seconds. */
  defaultSeconds: number;
  setDefaultSeconds: (s: number) => void;
  /** Whole seconds remaining, or 0 when no rest is running. */
  remaining: number;
  running: boolean;
  /** Start (or restart) a rest. Defaults to the user's preferred length. */
  startRest: (seconds?: number) => void;
  addTime: (delta: number) => void;
  skip: () => void;
}

const RestTimerContext = createContext<RestTimerContextValue | null>(null);

export function RestTimerProvider({ children }: { children: ReactNode }) {
  const [defaultSeconds, setDefaultSecondsState] = useState(DEFAULT_REST);
  const [loaded, setLoaded] = useState(false);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const firedRef = useRef(false);

  useEffect(() => {
    (async () => {
      const s = await storage.loadRestSeconds();
      if (s && s > 0) setDefaultSecondsState(s);
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (loaded) void storage.saveRestSeconds(defaultSeconds);
  }, [defaultSeconds, loaded]);

  // Tick only while a rest is running.
  useEffect(() => {
    if (endsAt === null) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [endsAt]);

  const remainingMs = endsAt === null ? 0 : Math.max(0, endsAt - now);
  const remaining = Math.ceil(remainingMs / 1000);

  // Buzz once when the rest completes, then clear.
  useEffect(() => {
    if (endsAt !== null && remainingMs === 0 && !firedRef.current) {
      firedRef.current = true;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEndsAt(null);
    }
  }, [endsAt, remainingMs]);

  const value = useMemo<RestTimerContextValue>(
    () => ({
      defaultSeconds,
      setDefaultSeconds: (s) => setDefaultSecondsState(Math.max(5, Math.round(s))),
      remaining,
      running: endsAt !== null,
      startRest: (seconds) => {
        firedRef.current = false;
        setEndsAt(Date.now() + (seconds ?? defaultSeconds) * 1000);
        setNow(Date.now());
      },
      addTime: (delta) =>
        setEndsAt((cur) => (cur === null ? cur : Math.max(Date.now(), cur + delta * 1000))),
      skip: () => setEndsAt(null),
    }),
    [defaultSeconds, remaining, endsAt],
  );

  return <RestTimerContext.Provider value={value}>{children}</RestTimerContext.Provider>;
}

export function useRestTimer(): RestTimerContextValue {
  const ctx = useContext(RestTimerContext);
  if (!ctx) throw new Error('useRestTimer must be used within a RestTimerProvider');
  return ctx;
}
