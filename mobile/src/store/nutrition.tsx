import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { computeGoal, type GoalInput } from '@/lib/nutrition';
import { storage, uid, type StoredCoachPlan } from '@/lib/storage';
import type { CoachPlan, FoodEntry, Goal } from '@/lib/types';

export interface NewFoodEntry {
  label: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  photoUri?: string;
}

interface NutritionContextValue {
  loaded: boolean;
  goal: Goal | null;
  entries: FoodEntry[];
  /** The last generated AI coaching plan, persisted so it isn't re-fetched on open. */
  coachPlan: CoachPlan | null;
  coachPlanAt: number | null;
  setGoal: (input: GoalInput) => Goal;
  clearGoal: () => void;
  addEntry: (entry: NewFoodEntry) => void;
  updateEntry: (id: string, patch: Partial<Omit<FoodEntry, 'id' | 'loggedAt'>>) => void;
  deleteEntry: (id: string) => void;
  getEntry: (id: string) => FoodEntry | undefined;
  entriesForDay: (dayStartMs: number, dayEndMs: number) => FoodEntry[];
  saveCoachPlan: (plan: CoachPlan) => void;
}

const NutritionContext = createContext<NutritionContextValue | null>(null);

export function NutritionProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [goal, setGoalState] = useState<Goal | null>(null);
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [coach, setCoach] = useState<StoredCoachPlan | null>(null);

  useEffect(() => {
    (async () => {
      const [g, e, c] = await Promise.all([
        storage.loadGoal(),
        storage.loadFoodEntries(),
        storage.loadCoachPlan(),
      ]);
      setGoalState(g);
      setEntries(e);
      setCoach(c);
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (loaded) void storage.saveGoal(goal);
  }, [goal, loaded]);
  useEffect(() => {
    if (loaded) void storage.saveFoodEntries(entries);
  }, [entries, loaded]);
  useEffect(() => {
    if (loaded) void storage.saveCoachPlan(coach);
  }, [coach, loaded]);

  const value = useMemo<NutritionContextValue>(
    () => ({
      loaded,
      goal,
      entries,
      coachPlan: coach?.plan ?? null,
      coachPlanAt: coach?.generatedAt ?? null,
      setGoal: (input) => {
        const computed = computeGoal(input);
        setGoalState(computed);
        // The saved plan was built for the old numbers — drop it so a stale plan
        // isn't shown. (It won't auto-regenerate; the user taps Generate again.)
        setCoach(null);
        return computed;
      },
      clearGoal: () => {
        setGoalState(null);
        setCoach(null);
      },
      addEntry: (entry) =>
        setEntries((cur) => [
          { ...entry, id: uid('food'), loggedAt: Date.now() },
          ...cur,
        ]),
      updateEntry: (id, patch) =>
        setEntries((cur) => cur.map((e) => (e.id === id ? { ...e, ...patch } : e))),
      deleteEntry: (id) => setEntries((cur) => cur.filter((e) => e.id !== id)),
      getEntry: (id) => entries.find((e) => e.id === id),
      entriesForDay: (start, end) =>
        entries.filter((e) => e.loggedAt >= start && e.loggedAt < end),
      saveCoachPlan: (plan) => setCoach({ plan, generatedAt: Date.now() }),
    }),
    [loaded, goal, entries, coach],
  );

  return <NutritionContext.Provider value={value}>{children}</NutritionContext.Provider>;
}

export function useNutrition(): NutritionContextValue {
  const ctx = useContext(NutritionContext);
  if (!ctx) throw new Error('useNutrition must be used within a NutritionProvider');
  return ctx;
}
