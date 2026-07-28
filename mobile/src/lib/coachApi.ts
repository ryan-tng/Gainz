import { API_BASE_URL } from './config';
import type { CoachContext, CoachPlan, Goal } from './types';

/**
 * Ask the backend for an AI coaching plan. The Mifflin–St Jeor numbers already
 * on the goal are sent along so the model reasons from real math instead of
 * estimating calories itself.
 */
export async function getCoachPlan(
  goal: Goal,
  weeksToGoal: number | null,
  recent: CoachContext,
): Promise<CoachPlan> {
  const res = await fetch(`${API_BASE_URL}/api/coach`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal, weeksToGoal, recent }),
  });

  const data = (await res.json().catch(() => ({}))) as Partial<CoachPlan> & {
    error?: string;
  };

  if (!res.ok) {
    throw new Error(data.error || 'Could not build your plan. Please try again.');
  }
  return data as CoachPlan;
}
