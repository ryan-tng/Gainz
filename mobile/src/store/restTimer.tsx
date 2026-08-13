import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
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
const AUTO_STOP_MS = 60_000; // stop a ringing alarm after a minute if ignored

interface RestTimerContextValue {
  /** User's default rest length, in seconds. */
  defaultSeconds: number;
  setDefaultSeconds: (s: number) => void;
  /** Whether to play the alarm sound when a rest ends. */
  alarmEnabled: boolean;
  setAlarmEnabled: (on: boolean) => void;
  /** Whole seconds remaining, or 0 when no rest is running. */
  remaining: number;
  running: boolean;
  /** True once a rest ends and the alarm is ringing (until dismissed). */
  alarming: boolean;
  /** Start (or restart) a rest. Defaults to the user's preferred length. */
  startRest: (seconds?: number) => void;
  addTime: (delta: number) => void;
  skip: () => void;
  /** Silence a ringing alarm. */
  stopAlarm: () => void;
}

const RestTimerContext = createContext<RestTimerContextValue | null>(null);

export function RestTimerProvider({ children }: { children: ReactNode }) {
  const [defaultSeconds, setDefaultSecondsState] = useState(DEFAULT_REST);
  const [alarmEnabled, setAlarmEnabledState] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [alarming, setAlarming] = useState(false);

  const firedRef = useRef(false);
  const playerRef = useRef<AudioPlayer | null>(null);
  const hapticTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alarmEnabledRef = useRef(alarmEnabled);
  alarmEnabledRef.current = alarmEnabled;

  useEffect(() => {
    (async () => {
      const [s, alarm] = await Promise.all([storage.loadRestSeconds(), storage.loadRestAlarm()]);
      if (s && s > 0) setDefaultSecondsState(s);
      if (alarm !== null) setAlarmEnabledState(alarm);
      setLoaded(true);
    })();
    // Let the alarm sound through the iOS silent switch.
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    return () => stopRinging();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loaded) void storage.saveRestSeconds(defaultSeconds);
  }, [defaultSeconds, loaded]);
  useEffect(() => {
    if (loaded) void storage.saveRestAlarm(alarmEnabled);
  }, [alarmEnabled, loaded]);

  /** Start the ringing alarm: looping sound + repeating vibration until dismissed. */
  const startRinging = () => {
    setAlarming(true);
    if (alarmEnabledRef.current) {
      try {
        if (!playerRef.current) {
          playerRef.current = createAudioPlayer(require('../../assets/sounds/rest-done.wav'));
        }
        playerRef.current.loop = true;
        playerRef.current.seekTo(0);
        playerRef.current.play();
      } catch {
        // ignore playback errors
      }
    }
    // Buzz immediately, then keep buzzing like a real alarm.
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    hapticTimer.current = setInterval(() => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }, 1400);
    autoStopTimer.current = setTimeout(() => stopRinging(), AUTO_STOP_MS);
  };

  const stopRinging = () => {
    if (hapticTimer.current) {
      clearInterval(hapticTimer.current);
      hapticTimer.current = null;
    }
    if (autoStopTimer.current) {
      clearTimeout(autoStopTimer.current);
      autoStopTimer.current = null;
    }
    try {
      playerRef.current?.pause();
      playerRef.current?.seekTo(0);
    } catch {
      // ignore
    }
    setAlarming(false);
  };

  // Tick only while a rest is counting down.
  useEffect(() => {
    if (endsAt === null) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [endsAt]);

  const remainingMs = endsAt === null ? 0 : Math.max(0, endsAt - now);
  const remaining = Math.ceil(remainingMs / 1000);

  // When the countdown reaches zero, start the ringing alarm.
  useEffect(() => {
    if (endsAt !== null && remainingMs === 0 && !firedRef.current) {
      firedRef.current = true;
      setEndsAt(null);
      startRinging();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endsAt, remainingMs]);

  const value = useMemo<RestTimerContextValue>(
    () => ({
      defaultSeconds,
      setDefaultSeconds: (s) => setDefaultSecondsState(Math.max(5, Math.round(s))),
      alarmEnabled,
      setAlarmEnabled: (on) => setAlarmEnabledState(on),
      remaining,
      running: endsAt !== null,
      alarming,
      startRest: (seconds) => {
        stopRinging();
        firedRef.current = false;
        setEndsAt(Date.now() + (seconds ?? defaultSeconds) * 1000);
        setNow(Date.now());
      },
      addTime: (delta) =>
        setEndsAt((cur) => (cur === null ? cur : Math.max(Date.now(), cur + delta * 1000))),
      skip: () => {
        stopRinging();
        setEndsAt(null);
      },
      stopAlarm: stopRinging,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [defaultSeconds, alarmEnabled, remaining, endsAt, alarming],
  );

  return <RestTimerContext.Provider value={value}>{children}</RestTimerContext.Provider>;
}

export function useRestTimer(): RestTimerContextValue {
  const ctx = useContext(RestTimerContext);
  if (!ctx) throw new Error('useRestTimer must be used within a RestTimerProvider');
  return ctx;
}
