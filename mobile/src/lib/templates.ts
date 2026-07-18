import { uid } from './storage';
import type { Exercise, TemplateExercise, TemplateSet, WorkoutTemplate } from './types';

/** Icon + color choices offered when creating a template. */
export const TEMPLATE_ICONS = [
  'barbell',
  'flame',
  'body',
  'fitness',
  'flash',
  'bonfire',
  'walk',
  'bicycle',
  'trophy',
  'hand-left',
] as const;

export const TEMPLATE_COLORS = [
  '#a3e635',
  '#34d399',
  '#22d3ee',
  '#fb923c',
  '#a78bfa',
  '#f472b6',
  '#f87171',
  '#fbbf24',
] as const;

interface DefaultTpl {
  name: string;
  icon: string;
  color: string;
  items: [name: string, targetSets: number][];
}

const DEFAULTS: DefaultTpl[] = [
  {
    name: 'Push Day',
    icon: 'flame',
    color: '#fb923c',
    items: [
      ['Barbell Bench Press', 4],
      ['Incline Dumbbell Press', 3],
      ['Overhead Press', 3],
      ['Tricep Pushdown', 3],
    ],
  },
  {
    name: 'Pull Day',
    icon: 'body',
    color: '#22d3ee',
    items: [
      ['Deadlift', 3],
      ['Pull-Up', 3],
      ['Bent-Over Row', 3],
      ['Barbell Curl', 3],
    ],
  },
  {
    name: 'Leg Day',
    icon: 'barbell',
    color: '#a3e635',
    items: [
      ['Back Squat', 4],
      ['Leg Press', 3],
      ['Romanian Deadlift', 3],
      ['Leg Curl', 3],
      ['Calf Raise', 3],
    ],
  },
];

/** A blank planned set (weight/reps filled in later, from history or by hand). */
function blankSets(count: number): TemplateSet[] {
  return Array.from({ length: Math.max(1, count) }, () => ({ weight: null, reps: null }));
}

/** Build the starter templates, mapping exercise names to the seeded library. */
export function buildDefaultTemplates(exercises: Exercise[]): WorkoutTemplate[] {
  const byName = new Map(exercises.map((e) => [e.name.toLowerCase(), e]));
  const now = Date.now();
  return DEFAULTS.map((t) => ({
    id: uid('tpl'),
    name: t.name,
    icon: t.icon,
    color: t.color,
    createdAt: now,
    updatedAt: now,
    exercises: t.items
      .map(([name, sets]) => {
        const ex = byName.get(name.toLowerCase());
        return ex
          ? { exerciseId: ex.id, name: ex.name, muscle: ex.muscle, sets: blankSets(sets) }
          : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null),
  }));
}

/**
 * Migrate stored templates to the current shape. Older templates stored
 * `targetSets: number` per exercise instead of a `sets` array — convert those.
 */
export function normalizeTemplates(templates: WorkoutTemplate[]): WorkoutTemplate[] {
  return templates.map((t) => ({
    ...t,
    exercises: t.exercises.map((raw) => {
      const te = raw as TemplateExercise & { targetSets?: number };
      if (Array.isArray(te.sets) && te.sets.length > 0) {
        return { exerciseId: te.exerciseId, name: te.name, muscle: te.muscle, sets: te.sets };
      }
      return {
        exerciseId: te.exerciseId,
        name: te.name,
        muscle: te.muscle,
        sets: blankSets(te.targetSets ?? 3),
      };
    }),
  }));
}
