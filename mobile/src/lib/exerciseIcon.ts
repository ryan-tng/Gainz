import { Ionicons } from '@expo/vector-icons';

import type { MuscleGroup } from './types';

type IoniconName = keyof typeof Ionicons.glyphMap;

/** A distinct icon per muscle group, so the list isn't all one symbol. */
const BY_MUSCLE: Record<MuscleGroup, IoniconName> = {
  Chest: 'barbell-outline',
  Back: 'body-outline',
  Legs: 'walk-outline',
  Shoulders: 'fitness-outline',
  Arms: 'barbell',
  Core: 'grid-outline',
  Cardio: 'heart-outline',
  Other: 'ellipse-outline',
};

/**
 * Name keywords take priority so specific movements get a fitting icon even
 * within the same muscle group (e.g. a run vs. a squat vs. a plank).
 */
const KEYWORDS: [RegExp, IoniconName][] = [
  [/tread|run|sprint|jog/, 'walk-outline'],
  [/bik|cycl|spin/, 'bicycle-outline'],
  [/\brow(ing)?\b/, 'boat-outline'],
  [/swim/, 'water-outline'],
  [/jump|burpee|\bhop\b|box jump|skip/, 'arrow-up-circle-outline'],
  [/stretch|yoga|mobil|foam/, 'accessibility-outline'],
  [/plank|crunch|sit.?up|hollow|russian|leg raise|\babs?\b|oblique/, 'grid-outline'],
  [/pull.?up|chin.?up|pulldown|\blat\b/, 'body-outline'],
  [/push.?up|\bdip/, 'body-outline'],
  [/jack|elliptical|climb|stair|cardio/, 'heart-outline'],
  [/curl/, 'barbell'],
];

/** Pick a representative Ionicon for an exercise from its name, then muscle. */
export function exerciseIcon(name: string, muscle: MuscleGroup): IoniconName {
  const n = name.toLowerCase();
  for (const [re, icon] of KEYWORDS) if (re.test(n)) return icon;
  return BY_MUSCLE[muscle] ?? 'barbell-outline';
}
