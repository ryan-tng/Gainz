import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppBackground } from '@/constants/theme';
import type {
  BodyWeightEntry,
  CoachPlan,
  Exercise,
  FoodEntry,
  Goal,
  Machine,
  Profile,
  WorkoutSession,
  WorkoutTemplate,
} from './types';

/** A saved coach plan plus when it was generated. */
export interface StoredCoachPlan {
  plan: CoachPlan;
  generatedAt: number;
}

const KEYS = {
  exercises: 'gainz:exercises',
  sessions: 'gainz:sessions',
  active: 'gainz:activeSession',
  machines: 'gainz:machines',
  foodEntries: 'gainz:foodEntries',
  goal: 'gainz:goal',
  templates: 'gainz:templates',
  coachPlan: 'gainz:coachPlan',
  profile: 'gainz:profile',
  theme: 'gainz:theme',
  coachName: 'gainz:coachName',
  restSeconds: 'gainz:restSeconds',
  restAlarm: 'gainz:restAlarm',
  bodyWeights: 'gainz:bodyWeights',
} as const;

/** Persisted theme preferences (mode + accent + home background). */
export interface StoredTheme {
  mode: 'dark' | 'light' | 'system';
  accent: string;
  background?: AppBackground;
  /** Photos the user has uploaded as backgrounds, kept so they can reuse them. */
  savedBackgrounds?: string[];
}

/** Simple unique id. Not cryptographic — fine for local records. */
export function uid(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ---- change notifier (drives auto cloud-sync) ----
type ChangeListener = () => void;
const changeListeners = new Set<ChangeListener>();
let suppressNotify = false;
function notifyChange() {
  if (!suppressNotify) changeListeners.forEach((l) => l());
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
  notifyChange();
}

async function removeKey(key: string): Promise<void> {
  await AsyncStorage.removeItem(key);
  notifyChange();
}

export const storage = {
  loadExercises: () => readJSON<Exercise[]>(KEYS.exercises, []),
  saveExercises: (v: Exercise[]) => writeJSON(KEYS.exercises, v),

  loadSessions: () => readJSON<WorkoutSession[]>(KEYS.sessions, []),
  saveSessions: (v: WorkoutSession[]) => writeJSON(KEYS.sessions, v),

  loadActive: () => readJSON<WorkoutSession | null>(KEYS.active, null),
  saveActive: (v: WorkoutSession | null) =>
    v ? writeJSON(KEYS.active, v) : removeKey(KEYS.active),

  loadMachines: () => readJSON<Machine[]>(KEYS.machines, []),
  saveMachines: (v: Machine[]) => writeJSON(KEYS.machines, v),

  loadFoodEntries: () => readJSON<FoodEntry[]>(KEYS.foodEntries, []),
  saveFoodEntries: (v: FoodEntry[]) => writeJSON(KEYS.foodEntries, v),

  loadGoal: () => readJSON<Goal | null>(KEYS.goal, null),
  saveGoal: (v: Goal | null) =>
    v ? writeJSON(KEYS.goal, v) : removeKey(KEYS.goal),

  loadTemplates: () => readJSON<WorkoutTemplate[]>(KEYS.templates, []),
  saveTemplates: (v: WorkoutTemplate[]) => writeJSON(KEYS.templates, v),

  loadCoachPlan: () => readJSON<StoredCoachPlan | null>(KEYS.coachPlan, null),
  saveCoachPlan: (v: StoredCoachPlan | null) =>
    v ? writeJSON(KEYS.coachPlan, v) : removeKey(KEYS.coachPlan),

  loadProfile: () => readJSON<Profile | null>(KEYS.profile, null),
  saveProfile: (v: Profile | null) =>
    v ? writeJSON(KEYS.profile, v) : removeKey(KEYS.profile),

  loadBodyWeights: () => readJSON<BodyWeightEntry[]>(KEYS.bodyWeights, []),
  saveBodyWeights: (v: BodyWeightEntry[]) => writeJSON(KEYS.bodyWeights, v),

  loadTheme: () => readJSON<StoredTheme | null>(KEYS.theme, null),
  saveTheme: (v: StoredTheme) => writeJSON(KEYS.theme, v),

  loadCoachName: () => readJSON<string | null>(KEYS.coachName, null),
  saveCoachName: (v: string) => writeJSON(KEYS.coachName, v),

  loadRestSeconds: () => readJSON<number | null>(KEYS.restSeconds, null),
  saveRestSeconds: (v: number) => writeJSON(KEYS.restSeconds, v),

  loadRestAlarm: () => readJSON<boolean | null>(KEYS.restAlarm, null),
  saveRestAlarm: (v: boolean) => writeJSON(KEYS.restAlarm, v),

  /** Wipe every Gainz key — used by "Reset app data" and sign-out. */
  clearAll: async () => {
    suppressNotify = true;
    try {
      await AsyncStorage.multiRemove(Object.values(KEYS));
    } finally {
      suppressNotify = false;
    }
  },

  /** Snapshot of all Gainz keys → raw JSON strings, for cloud backup. */
  exportAll: async (): Promise<Record<string, string>> => {
    const pairs = await AsyncStorage.multiGet(Object.values(KEYS));
    const out: Record<string, string> = {};
    for (const [k, v] of pairs) if (v != null) out[k] = v;
    return out;
  },

  /** Overwrite local storage from a cloud backup snapshot (no change events). */
  importAll: async (data: Record<string, string>): Promise<void> => {
    const entries = Object.entries(data).filter(([k]) =>
      (Object.values(KEYS) as string[]).includes(k),
    );
    if (!entries.length) return;
    suppressNotify = true;
    try {
      await AsyncStorage.multiSet(entries);
    } finally {
      suppressNotify = false;
    }
  },

  /** Subscribe to local data changes (for auto cloud-sync). Returns an unsubscribe. */
  onChange: (cb: ChangeListener): (() => void) => {
    changeListeners.add(cb);
    return () => {
      changeListeners.delete(cb);
    };
  },
};
