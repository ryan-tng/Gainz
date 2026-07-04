import { ACTIVITY_LEVELS, type ActivityKey, type Goal, type Sex } from './types';

const KCAL_PER_LB = 3500;

export interface GoalInput {
  sex: Sex;
  age: number;
  heightIn: number;
  currentWeightLb: number;
  targetWeightLb: number;
  activity: ActivityKey;
  weeklyRateLb: number;
}

function activityFactor(key: ActivityKey): number {
  return ACTIVITY_LEVELS.find((a) => a.key === key)?.factor ?? 1.2;
}

/**
 * Compute maintenance (TDEE) and a daily calorie target using the
 * Mifflin–St Jeor equation, then apply a deficit/surplus for the goal.
 */
export function computeGoal(input: GoalInput): Goal {
  const weightKg = input.currentWeightLb * 0.453592;
  const heightCm = input.heightIn * 2.54;

  // Mifflin–St Jeor BMR
  const bmr =
    10 * weightKg +
    6.25 * heightCm -
    5 * input.age +
    (input.sex === 'male' ? 5 : -161);

  const maintenance = bmr * activityFactor(input.activity);

  // Direction: lose weight → deficit; gain → surplus; maintain → 0.
  const wantsLoss = input.targetWeightLb < input.currentWeightLb;
  const wantsGain = input.targetWeightLb > input.currentWeightLb;
  const rate = wantsLoss || wantsGain ? Math.abs(input.weeklyRateLb) : 0;
  const dailyDelta = (rate * KCAL_PER_LB) / 7;

  let target = maintenance + (wantsGain ? dailyDelta : wantsLoss ? -dailyDelta : 0);

  // Safety floor so we never recommend an unsafely low intake.
  const floor = input.sex === 'male' ? 1500 : 1200;
  target = Math.max(target, floor);

  // Macro split: protein ~1g per lb bodyweight, fat 25% of calories, rest carbs.
  const proteinG = Math.round(input.currentWeightLb);
  const fatG = Math.round((target * 0.25) / 9);
  const carbsG = Math.max(0, Math.round((target - proteinG * 4 - fatG * 9) / 4));

  return {
    ...input,
    maintenanceCalories: Math.round(maintenance),
    targetCalories: Math.round(target),
    proteinTargetG: proteinG,
    carbsTargetG: carbsG,
    fatTargetG: fatG,
    updatedAt: Date.now(),
  };
}

/** Weeks to reach the target weight at the chosen weekly rate (null if maintaining). */
export function weeksToGoal(input: GoalInput): number | null {
  const diff = Math.abs(input.targetWeightLb - input.currentWeightLb);
  if (diff < 0.5 || input.weeklyRateLb <= 0) return null;
  return Math.ceil(diff / input.weeklyRateLb);
}
