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
  defaultSeconds: number;
  setDefaultSeconds: (s: number) => void;
  alarmEnabled: boolean;
  setAlarmEnabled: (on: boolean) => void;
  /** Epoch ms when the current rest ends, or null if none is running. */
  endsAt: number | null;
  running: boolean;
  /** True once a rest ends and the alarm is ringing (until dismissed). */
  alarming: boolean;
  startRest: (seconds?: number) => void;
  addTime: (delta: number) => void;
  skip: () => void;
  stopAlarm: () => void;
}

const RestTimerContext = createContext<RestTimerContextValue | null>(null);

export function RestTimerProvider({ children }: { children: ReactNode }) {
  const [defaultSeconds, setDefaultSecondsState] = useState(DEFAULT_REST);
  const [alarmEnabled, setAlarmEnabledState] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [alarming, setAlarming] = useState(false);

  const playerRef = useRef<AudioPlayer | null>(null);
  const endTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const clearEndTimer = () => {
    if (endTimer.current) {
      clearTimeout(endTimer.current);
      endTimer.current = null;
    }
  };

  const startRinging = () => {
    setEndsAt(null);
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

  const scheduleEnd = (ms: number) => {
    clearEndTimer();
    endTimer.current = setTimeout(startRinging, Math.max(0, ms));
  };

  const value = useMemo<RestTimerContextValue>(
    () => ({
      defaultSeconds,
      setDefaultSeconds: (s) => setDefaultSecondsState(Math.max(5, Math.round(s))),
      alarmEnabled,
      setAlarmEnabled: (on) => setAlarmEnabledState(on),
      endsAt,
      running: endsAt !== null,
      alarming,
      startRest: (seconds) => {
        stopRinging();
        const secs = seconds ?? defaultSeconds;
        setEndsAt(Date.now() + secs * 1000);
        scheduleEnd(secs * 1000);
      },
      addTime: (delta) =>
        setEndsAt((cur) => {
          if (cur === null) return cur;
          const next = Math.max(Date.now(), cur + delta * 1000);
          scheduleEnd(next - Date.now());
          return next;
        }),
      skip: () => {
        clearEndTimer();
        stopRinging();
        setEndsAt(null);
      },
      stopAlarm: stopRinging,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [defaultSeconds, alarmEnabled, endsAt, alarming],
  );

  return <RestTimerContext.Provider value={value}>{children}</RestTimerContext.Provider>;
}

export function useRestTimer(): RestTimerContextValue {
  const ctx = useContext(RestTimerContext);
  if (!ctx) throw new Error('useRestTimer must be used within a RestTimerProvider');
  return ctx;
}
