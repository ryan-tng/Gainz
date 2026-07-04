import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { SEED_EXERCISES } from '@/lib/seed';
import { storage, uid } from '@/lib/storage';
import type {
  Exercise,
  MuscleGroup,
  SetEntry,
  WorkoutExercise,
  WorkoutSession,
} from '@/lib/types';

interface WorkoutContextValue {
  loaded: boolean;
  exercises: Exercise[];
  sessions: WorkoutSession[]; // finished, newest first
  active: WorkoutSession | null;

  addCustomExercise: (name: string, muscle: MuscleGroup) => Exercise;

  startWorkout: (name?: string) => void;
  addExercisesToActive: (exerciseIds: string[]) => void;
  removeWorkoutExercise: (workoutExerciseId: string) => void;
  addSet: (workoutExerciseId: string) => void;
  updateSet: (
    workoutExerciseId: string,
    setId: string,
    patch: Partial<Pick<SetEntry, 'weight' | 'reps' | 'done'>>,
  ) => void;
  removeSet: (workoutExerciseId: string, setId: string) => void;
  finishWorkout: () => string | null; // returns saved session id
  cancelWorkout: () => void;

  deleteSession: (id: string) => void;
}

const WorkoutContext = createContext<WorkoutContextValue | null>(null);

function newSet(): SetEntry {
  return { id: uid('set'), weight: null, reps: null, done: false };
}

export function WorkoutProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [active, setActive] = useState<WorkoutSession | null>(null);

  // Load everything on mount; seed the exercise library on first run.
  useEffect(() => {
    (async () => {
      const [loadedExercises, loadedSessions, loadedActive] = await Promise.all([
        storage.loadExercises(),
        storage.loadSessions(),
        storage.loadActive(),
      ]);

      let ex = loadedExercises;
      if (ex.length === 0) {
        ex = SEED_EXERCISES.map((e) => ({ ...e, id: uid('ex') }));
        await storage.saveExercises(ex);
      }
      setExercises(ex);
      setSessions(loadedSessions);
      setActive(loadedActive);
      setLoaded(true);
    })();
  }, []);

  // Persist on change (after initial load).
  useEffect(() => {
    if (loaded) void storage.saveExercises(exercises);
  }, [exercises, loaded]);
  useEffect(() => {
    if (loaded) void storage.saveSessions(sessions);
  }, [sessions, loaded]);
  useEffect(() => {
    if (loaded) void storage.saveActive(active);
  }, [active, loaded]);

  const value = useMemo<WorkoutContextValue>(() => {
    const patchExercise = (
      workoutExerciseId: string,
      fn: (we: WorkoutExercise) => WorkoutExercise,
    ) =>
      setActive((cur) =>
        cur
          ? {
              ...cur,
              exercises: cur.exercises.map((we) =>
                we.id === workoutExerciseId ? fn(we) : we,
              ),
            }
          : cur,
      );

    return {
      loaded,
      exercises,
      sessions,
      active,

      addCustomExercise: (name, muscle) => {
        const ex: Exercise = { id: uid('ex'), name: name.trim(), muscle, isCustom: true };
        setExercises((cur) =>
          [...cur, ex].sort((a, b) => a.name.localeCompare(b.name)),
        );
        return ex;
      },

      startWorkout: (name) => {
        setActive({
          id: uid('ws'),
          name: name?.trim() || 'Workout',
          startedAt: Date.now(),
          finishedAt: null,
          exercises: [],
        });
      },

      addExercisesToActive: (exerciseIds) => {
        setActive((cur) => {
          if (!cur) return cur;
          const existing = new Set(cur.exercises.map((we) => we.exerciseId));
          const toAdd = exerciseIds
            .filter((id) => !existing.has(id))
            .map((id) => exercises.find((e) => e.id === id))
            .filter((e): e is Exercise => !!e)
            .map<WorkoutExercise>((e) => ({
              id: uid('we'),
              exerciseId: e.id,
              name: e.name,
              muscle: e.muscle,
              sets: [newSet()],
            }));
          return { ...cur, exercises: [...cur.exercises, ...toAdd] };
        });
      },

      removeWorkoutExercise: (workoutExerciseId) =>
        setActive((cur) =>
          cur
            ? { ...cur, exercises: cur.exercises.filter((we) => we.id !== workoutExerciseId) }
            : cur,
        ),

      addSet: (workoutExerciseId) =>
        patchExercise(workoutExerciseId, (we) => ({
          ...we,
          // Prefill from the last set for faster logging.
          sets: [
            ...we.sets,
            we.sets.length
              ? { ...newSet(), weight: we.sets[we.sets.length - 1].weight, reps: we.sets[we.sets.length - 1].reps }
              : newSet(),
          ],
        })),

      updateSet: (workoutExerciseId, setId, patch) =>
        patchExercise(workoutExerciseId, (we) => ({
          ...we,
          sets: we.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)),
        })),

      removeSet: (workoutExerciseId, setId) =>
        patchExercise(workoutExerciseId, (we) => ({
          ...we,
          sets: we.sets.filter((s) => s.id !== setId),
        })),

      finishWorkout: () => {
        if (!active) return null;
        const finished: WorkoutSession = { ...active, finishedAt: Date.now() };
        setSessions((cur) => [finished, ...cur]);
        setActive(null);
        return finished.id;
      },

      cancelWorkout: () => setActive(null),

      deleteSession: (id) => setSessions((cur) => cur.filter((s) => s.id !== id)),
    };
  }, [loaded, exercises, sessions, active]);

  return <WorkoutContext.Provider value={value}>{children}</WorkoutContext.Provider>;
}

export function useWorkouts(): WorkoutContextValue {
  const ctx = useContext(WorkoutContext);
  if (!ctx) throw new Error('useWorkouts must be used within a WorkoutProvider');
  return ctx;
}
