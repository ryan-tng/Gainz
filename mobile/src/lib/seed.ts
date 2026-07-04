import type { Exercise, Machine } from './types';

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

/** Default machine tutorials, seeded on first launch. Add your own photos on top. */
export const SEED_MACHINES: Omit<Machine, 'id'>[] = [
  {
    name: 'Leg Press',
    muscle: 'Legs',
    photos: [],
    steps: [
      'Sit back with your spine and head against the pad.',
      'Place feet shoulder-width on the platform, toes slightly out.',
      'Release the safety handles and lower until knees reach ~90°.',
      'Push through your heels to extend — stop just short of locking knees.',
    ],
    tip: 'Never let your lower back round off the seat at the bottom.',
  },
  {
    name: 'Lat Pulldown',
    muscle: 'Back',
    photos: [],
    steps: [
      'Set the thigh pad so your legs are snug underneath.',
      'Grip the bar wider than shoulder-width, palms forward.',
      'Pull the bar to your upper chest, driving elbows down and back.',
      'Control the bar back up until arms are fully extended.',
    ],
    tip: 'Lead with your elbows, not your hands, to hit your lats.',
  },
  {
    name: 'Seated Cable Row',
    muscle: 'Back',
    photos: [],
    steps: [
      'Sit with knees slightly bent, feet on the platform.',
      'Grab the handle and sit tall with a neutral spine.',
      'Pull the handle to your stomach, squeezing shoulder blades.',
      'Extend arms forward under control without slouching.',
    ],
    tip: 'Keep your torso still — row with your back, not your momentum.',
  },
  {
    name: 'Leg Extension',
    muscle: 'Legs',
    photos: [],
    steps: [
      'Adjust the pad to rest on your lower shins.',
      'Align your knees with the machine’s pivot point.',
      'Extend your legs until nearly straight, squeezing your quads.',
      'Lower under control back to the start.',
    ],
    tip: 'Pause for a second at the top for a stronger contraction.',
  },
  {
    name: 'Chest Press Machine',
    muscle: 'Chest',
    photos: [],
    steps: [
      'Set the seat so the handles line up with mid-chest.',
      'Grip the handles and keep your back on the pad.',
      'Press forward until arms are nearly extended.',
      'Return slowly until you feel a stretch across your chest.',
    ],
    tip: 'Keep wrists straight and elbows a touch below shoulder height.',
  },
  {
    name: 'Cable Machine',
    muscle: 'Other',
    photos: [],
    steps: [
      'Set the pulley height for your exercise (low, mid, or high).',
      'Attach the handle or rope you need.',
      'Select the weight with the pin.',
      'Keep tension on the cable through the full range of motion.',
    ],
    tip: 'Step away from the stack so there’s tension even at the start.',
  },
];
