import type { Exercise } from './types';

/** Default exercise library, seeded on first launch. Users can add their own on top. */
export const SEED_EXERCISES: Omit<Exercise, 'id'>[] = [
  // Chest
  { name: 'Barbell Bench Press', muscle: 'Chest' },
  { name: 'Incline Dumbbell Press', muscle: 'Chest' },
  { name: 'Cable Fly', muscle: 'Chest' },
  { name: 'Push-Up', muscle: 'Chest' },
  // Back
  { name: 'Deadlift', muscle: 'Back' },
  { name: 'Pull-Up', muscle: 'Back' },
  { name: 'Bent-Over Row', muscle: 'Back' },
  { name: 'Lat Pulldown', muscle: 'Back' },
  { name: 'Seated Cable Row', muscle: 'Back' },
  // Legs
  { name: 'Back Squat', muscle: 'Legs' },
  { name: 'Leg Press', muscle: 'Legs' },
  { name: 'Romanian Deadlift', muscle: 'Legs' },
  { name: 'Leg Extension', muscle: 'Legs' },
  { name: 'Leg Curl', muscle: 'Legs' },
  { name: 'Walking Lunge', muscle: 'Legs' },
  { name: 'Calf Raise', muscle: 'Legs' },
  // Shoulders
  { name: 'Overhead Press', muscle: 'Shoulders' },
  { name: 'Dumbbell Lateral Raise', muscle: 'Shoulders' },
  { name: 'Face Pull', muscle: 'Shoulders' },
  // Arms
  { name: 'Barbell Curl', muscle: 'Arms' },
  { name: 'Dumbbell Curl', muscle: 'Arms' },
  { name: 'Tricep Pushdown', muscle: 'Arms' },
  { name: 'Skullcrusher', muscle: 'Arms' },
  // Core
  { name: 'Plank', muscle: 'Core' },
  { name: 'Hanging Leg Raise', muscle: 'Core' },
  { name: 'Cable Crunch', muscle: 'Core' },
  // Cardio
  { name: 'Treadmill Run', muscle: 'Cardio' },
  { name: 'Rowing Machine', muscle: 'Cardio' },
  { name: 'Stationary Bike', muscle: 'Cardio' },
];
