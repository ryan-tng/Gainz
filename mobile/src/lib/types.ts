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

/** A gym machine with a quick-access photo tutorial. */
export interface Machine {
  id: string;
  name: string;
  muscle: MuscleGroup;
  /** Local image URIs (photos of the machine or its instruction placard). */
  photos: string[];
  /** Short how-to steps, shown as a numbered list. */
  steps: string[];
  /** Optional free-form tip. */
  tip?: string;
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

// ---------- Nutrition (Phase C + D) ----------

export interface FoodItem {
  name: string;
  quantity: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

/** The AI food-scan result returned by the backend. */
export interface FoodAnalysis {
  items: FoodItem[];
  total_calories: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  confidence: 'low' | 'medium' | 'high';
  notes: string;
}

/** A logged meal/food entry. */
export interface FoodEntry {
  id: string;
  loggedAt: number; // epoch ms
  label: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  photoUri?: string;
}

export const SEXES = ['male', 'female'] as const;
export type Sex = (typeof SEXES)[number];

export const ACTIVITY_LEVELS = [
  { key: 'sedentary', label: 'Sedentary', desc: 'Little or no exercise', factor: 1.2 },
  { key: 'light', label: 'Light', desc: '1–3 workouts / week', factor: 1.375 },
  { key: 'moderate', label: 'Moderate', desc: '3–5 workouts / week', factor: 1.55 },
  { key: 'active', label: 'Active', desc: '6–7 workouts / week', factor: 1.725 },
  { key: 'athlete', label: 'Athlete', desc: 'Hard daily training', factor: 1.9 },
] as const;

export type ActivityKey = (typeof ACTIVITY_LEVELS)[number]['key'];

/** The user's goal + profile, plus the computed daily targets. */
export interface Goal {
  sex: Sex;
  age: number;
  heightIn: number; // inches
  currentWeightLb: number;
  targetWeightLb: number;
  activity: ActivityKey;
  weeklyRateLb: number; // desired lbs/week toward target (magnitude)
  // computed:
  maintenanceCalories: number;
  targetCalories: number;
  proteinTargetG: number;
  carbsTargetG: number;
  fatTargetG: number;
  updatedAt: number;
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
