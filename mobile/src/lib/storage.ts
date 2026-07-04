import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Exercise, WorkoutSession } from './types';

const KEYS = {
  exercises: 'gainz:exercises',
  sessions: 'gainz:sessions',
  active: 'gainz:activeSession',
} as const;

/** Simple unique id. Not cryptographic — fine for local records. */
export function uid(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function readJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function writeJSON(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export const storage = {
  loadExercises: () => readJSON<Exercise[]>(KEYS.exercises, []),
  saveExercises: (v: Exercise[]) => writeJSON(KEYS.exercises, v),

  loadSessions: () => readJSON<WorkoutSession[]>(KEYS.sessions, []),
  saveSessions: (v: WorkoutSession[]) => writeJSON(KEYS.sessions, v),

  loadActive: () => readJSON<WorkoutSession | null>(KEYS.active, null),
  saveActive: (v: WorkoutSession | null) =>
    v ? writeJSON(KEYS.active, v) : AsyncStorage.removeItem(KEYS.active),
};
