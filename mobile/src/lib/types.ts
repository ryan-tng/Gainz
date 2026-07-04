export const MUSCLE_GROUPS = [
  'Chest',
  'Back',
  'Legs',
  'Shoulders',
  'Arms',
  'Core',
  'Cardio',
  'Other',
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export interface Exercise {
  id: string;
  name: string;
  muscle: MuscleGroup;
  isCustom?: boolean;
}

export interface SetEntry {
  id: string;
  weight: number | null; // lb
  reps: number | null;
  done: boolean;
}

/** An exercise as it appears inside a workout session (denormalized for history stability). */
export interface WorkoutExercise {
  id: string;
  exerciseId: string;
  name: string;
  muscle: MuscleGroup;
  sets: SetEntry[];
}

export interface WorkoutSession {
  id: string;
  name: string;
  startedAt: number; // epoch ms
  finishedAt: number | null;
  exercises: WorkoutExercise[];
}

/** Total completed sets and volume (weight × reps) for a finished session. */
export function sessionStats(session: WorkoutSession) {
  let sets = 0;
  let volume = 0;
  for (const ex of session.exercises) {
    for (const s of ex.sets) {
      if (s.done) {
        sets += 1;
        volume += (s.weight ?? 0) * (s.reps ?? 0);
      }
    }
  }
  return { sets, volume, exercises: session.exercises.length };
}
