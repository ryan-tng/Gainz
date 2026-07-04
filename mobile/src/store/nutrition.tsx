import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { computeGoal, type GoalInput } from '@/lib/nutrition';
import { storage, uid } from '@/lib/storage';
import type { FoodEntry, Goal } from '@/lib/types';

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
  setGoal: (input: GoalInput) => Goal;
  clearGoal: () => void;
  addEntry: (entry: NewFoodEntry) => void;
  deleteEntry: (id: string) => void;
  entriesForDay: (dayStartMs: number, dayEndMs: number) => FoodEntry[];
}

const NutritionContext = createContext<NutritionContextValue | null>(null);

export function NutritionProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [goal, setGoalState] = useState<Goal | null>(null);
  const [entries, setEntries] = useState<FoodEntry[]>([]);

  useEffect(() => {
    (async () => {
      const [g, e] = await Promise.all([storage.loadGoal(), storage.loadFoodEntries()]);
      setGoalState(g);
      setEntries(e);
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (loaded) void storage.saveGoal(goal);
  }, [goal, loaded]);
  useEffect(() => {
    if (loaded) void storage.saveFoodEntries(entries);
  }, [entries, loaded]);

  const value = useMemo<NutritionContextValue>(
    () => ({
      loaded,
      goal,
      entries,
      setGoal: (input) => {
        const computed = computeGoal(input);
        setGoalState(computed);
        return computed;
      },
      clearGoal: () => setGoalState(null),
      addEntry: (entry) =>
        setEntries((cur) => [
          { ...entry, id: uid('food'), loggedAt: Date.now() },
          ...cur,
        ]),
      deleteEntry: (id) => setEntries((cur) => cur.filter((e) => e.id !== id)),
      entriesForDay: (start, end) =>
        entries.filter((e) => e.loggedAt >= start && e.loggedAt < end),
    }),
    [loaded, goal, entries],
  );

  return <NutritionContext.Provider value={value}>{children}</NutritionContext.Provider>;
}

export function useNutrition(): NutritionContextValue {
  const ctx = useContext(NutritionContext);
  if (!ctx) throw new Error('useNutrition must be used within a NutritionProvider');
  return ctx;
}
