import { ML_BASE_URL } from './config';
import type { BodyWeightEntry, FoodEntry } from './types';

export interface AdaptiveTdee {
  maintenance_calories: number;
  recommended_target: number;
  trend_lb_per_week: number;
  avg_intake: number;
  days_analyzed: number;
  confidence: 'low' | 'medium' | 'high';
  needs_more_data: boolean;
  note: string;
}

/**
 * Ask the Python ML service to fit the user's true maintenance calories from
 * their body-weight trend and logged intake.
 */
export async function getAdaptiveTdee(
  weights: BodyWeightEntry[],
  entries: FoodEntry[],
  goalRateLbPerWeek: number,
): Promise<AdaptiveTdee> {
  const res = await fetch(`${ML_BASE_URL}/adaptive-tdee`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      weights: weights.map((w) => ({ at: w.loggedAt, lb: w.weightLb })),
      intake: entries.map((e) => ({ at: e.loggedAt, kcal: e.calories })),
      goalRateLbPerWeek,
    }),
  });
  if (!res.ok) throw new Error('Could not compute your adaptive target. Please try again.');
  return (await res.json()) as AdaptiveTdee;
}
