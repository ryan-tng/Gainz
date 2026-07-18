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
import { buildDefaultTemplates, normalizeTemplates } from '@/lib/templates';
import type {
  Exercise,
  MuscleGroup,
  SetEntry,
  TemplateExercise,
  TemplateSet,
  WorkoutExercise,
  WorkoutSession,
  WorkoutTemplate,
} from '@/lib/types';

export type TemplateInput = Pick<WorkoutTemplate, 'name' | 'icon' | 'color' | 'exercises'>;

interface WorkoutContextValue {
  loaded: boolean;
  exercises: Exercise[];
  sessions: WorkoutSession[]; // finished, newest first
  active: WorkoutSession | null;
  templates: WorkoutTemplate[];

  addCustomExercise: (name: string, muscle: MuscleGroup) => Exercise;

  addTemplate: (input: TemplateInput) => WorkoutTemplate;
  updateTemplate: (id: string, input: TemplateInput) => void;
  deleteTemplate: (id: string) => void;
  duplicateTemplate: (id: string) => void;
  getTemplate: (id: string) => WorkoutTemplate | undefined;
  /** The sets (weight × reps) the user most recently did for an exercise, if any. */
  getLastPerformance: (exerciseId: string) => TemplateSet[] | null;

  startWorkout: (name?: string) => void;
  startFromTemplate: (templateId: string) => void;
  addExercisesToActive: (exerciseIds: string[]) => void;
  removeWorkoutExercise: (workoutExerciseId: string) => void;
  addSet: (workoutExerciseId: string) => void;
  updateSet: (
    workoutExerciseId: string,
    setId: string,
    patch: Partial<Pick<SetEntry, 'weight' | 'reps' | 'done'>>,
  ) => void;
  removeSet: (workoutExerciseId: string, setId: string) => void;
  /** Mark every set in an exercise done (or not) — "exercise complete" toggle. */
  setExerciseDone: (workoutExerciseId: string, done: boolean) => void;
  /** Pause the timer if running, or resume it if paused. */
  togglePause: () => void;
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
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);

  // Load everything on mount; seed the exercise library + starter templates on first run.
  useEffect(() => {
    (async () => {
      const [loadedExercises, loadedSessions, loadedActive, loadedTemplates] =
        await Promise.all([
          storage.loadExercises(),
          storage.loadSessions(),
          storage.loadActive(),
          storage.loadTemplates(),
        ]);

      let ex = loadedExercises;
      if (ex.length === 0) {
        ex = SEED_EXERCISES.map((e) => ({ ...e, id: uid('ex') }));
        await storage.saveExercises(ex);
      }

      let tpl = normalizeTemplates(loadedTemplates);
      if (tpl.length === 0) {
        tpl = buildDefaultTemplates(ex);
      }
      // Persist if we seeded or migrated anything.
      if (tpl !== loadedTemplates) {
        await storage.saveTemplates(tpl);
      }

      setExercises(ex);
      setSessions(loadedSessions);
      setActive(loadedActive);
      setTemplates(tpl);
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
  useEffect(() => {
    if (loaded) void storage.saveTemplates(templates);
  }, [templates, loaded]);

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

    const templateToExercises = (tpl: WorkoutTemplate): WorkoutExercise[] =>
      tpl.exercises.map((te: TemplateExercise) => ({
        id: uid('we'),
        exerciseId: te.exerciseId,
        name: te.name,
        muscle: te.muscle,
        // Prefill each set with the weight/reps the user usually does.
        sets: (te.sets.length ? te.sets : [{ weight: null, reps: null }]).map((ts) => ({
          id: uid('set'),
          weight: ts.weight,
          reps: ts.reps,
          done: false,
        })),
      }));

    /** Sets actually performed for an exercise in a session (prefer completed). */
    const performedSets = (we: WorkoutExercise): TemplateSet[] => {
      const meaningful = we.sets.filter((s) => s.weight !== null || s.reps !== null);
      const done = meaningful.filter((s) => s.done);
      const use = done.length ? done : meaningful;
      return use.map((s) => ({ weight: s.weight, reps: s.reps }));
    };

    return {
      loaded,
      exercises,
      sessions,
      active,
      templates,

      addCustomExercise: (name, muscle) => {
        const ex: Exercise = { id: uid('ex'), name: name.trim(), muscle, isCustom: true };
        setExercises((cur) =>
          [...cur, ex].sort((a, b) => a.name.localeCompare(b.name)),
        );
        return ex;
      },

      addTemplate: (input) => {
        const now = Date.now();
        const tpl: WorkoutTemplate = { ...input, id: uid('tpl'), createdAt: now, updatedAt: now };
        setTemplates((cur) => [...cur, tpl]);
        return tpl;
      },
      updateTemplate: (id, input) =>
        setTemplates((cur) =>
          cur.map((t) => (t.id === id ? { ...t, ...input, updatedAt: Date.now() } : t)),
        ),
      deleteTemplate: (id) => setTemplates((cur) => cur.filter((t) => t.id !== id)),
      duplicateTemplate: (id) =>
        setTemplates((cur) => {
          const src = cur.find((t) => t.id === id);
          if (!src) return cur;
          const now = Date.now();
          return [
            ...cur,
            { ...src, id: uid('tpl'), name: `${src.name} copy`, createdAt: now, updatedAt: now },
          ];
        }),
      getTemplate: (id) => templates.find((t) => t.id === id),

      getLastPerformance: (exerciseId) => {
        for (const s of sessions) {
          // sessions are newest-first
          const we = s.exercises.find((w) => w.exerciseId === exerciseId);
          if (we) {
            const sets = performedSets(we);
            if (sets.length) return sets;
          }
        }
        return null;
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

      startFromTemplate: (templateId) => {
        const tpl = templates.find((t) => t.id === templateId);
        if (!tpl) return;
        setActive({
          id: uid('ws'),
          name: tpl.name,
          startedAt: Date.now(),
          finishedAt: null,
          exercises: templateToExercises(tpl),
          templateId: tpl.id,
          icon: tpl.icon,
          color: tpl.color,
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

      setExerciseDone: (workoutExerciseId, done) =>
        patchExercise(workoutExerciseId, (we) => ({
          ...we,
          sets: we.sets.map((s) => ({ ...s, done })),
        })),

      togglePause: () =>
        setActive((cur) => {
          if (!cur) return cur;
          if (cur.pausedAt != null) {
            // Resume: bank the paused duration, clear the pause marker.
            return {
              ...cur,
              pausedMs: (cur.pausedMs ?? 0) + (Date.now() - cur.pausedAt),
              pausedAt: null,
            };
          }
          // Pause: stamp the moment we paused.
          return { ...cur, pausedAt: Date.now() };
        }),

      finishWorkout: () => {
        if (!active) return null;
        // If finishing while paused, bank the outstanding paused time first.
        const banked: WorkoutSession =
          active.pausedAt != null
            ? { ...active, pausedMs: (active.pausedMs ?? 0) + (Date.now() - active.pausedAt), pausedAt: null }
            : active;
        const finished: WorkoutSession = { ...banked, finishedAt: Date.now() };
        setSessions((cur) => [finished, ...cur]);

        // Learn: update the source template's target sets to what was just done,
        // so next time it prefills the weight/reps you usually do.
        if (active.templateId) {
          setTemplates((cur) =>
            cur.map((t) => {
              if (t.id !== active.templateId) return t;
              let changed = false;
              const exercises = t.exercises.map((te) => {
                const we = finished.exercises.find((w) => w.exerciseId === te.exerciseId);
                if (!we) return te;
                const sets = performedSets(we);
                if (!sets.length) return te;
                changed = true;
                return { ...te, sets };
              });
              return changed ? { ...t, exercises, updatedAt: Date.now() } : t;
            }),
          );
        }

        setActive(null);
        return finished.id;
      },

      cancelWorkout: () => setActive(null),

      deleteSession: (id) => setSessions((cur) => cur.filter((s) => s.id !== id)),
    };
  }, [loaded, exercises, sessions, active, templates]);

  return <WorkoutContext.Provider value={value}>{children}</WorkoutContext.Provider>;
}

export function useWorkouts(): WorkoutContextValue {
  const ctx = useContext(WorkoutContext);
  if (!ctx) throw new Error('useWorkouts must be used within a WorkoutProvider');
  return ctx;
}
