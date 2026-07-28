import { startOfDay, startOfWeek } from './format';
import { sessionStats, type MuscleGroup, type WorkoutSession } from './types';

export interface DayBar {
  label: string; // weekday initial
  value: number; // volume that day
  isToday: boolean;
}

export interface Dashboard {
  totalWorkouts: number;
  thisWeek: number;
  weekStreak: number;
  totalVolume: number;
  totalSets: number;
  last7: DayBar[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const WEEKDAY = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function computeDashboard(sessions: WorkoutSession[]): Dashboard {
  const now = Date.now();
  const weekStart = startOfWeek(now);
  const todayStart = startOfDay(now);

  let totalVolume = 0;
  let totalSets = 0;
  let thisWeek = 0;
  for (const s of sessions) {
    const st = sessionStats(s);
    totalVolume += st.volume;
    totalSets += st.sets;
    if ((s.finishedAt ?? s.startedAt) >= weekStart) thisWeek += 1;
  }

  // Week streak: consecutive weeks (ending this week) with >= 1 workout.
  const weeksWithWork = new Set<number>();
  for (const s of sessions) {
    weeksWithWork.add(startOfWeek(s.finishedAt ?? s.startedAt));
  }
  let weekStreak = 0;
  let cursor = weekStart;
  while (weeksWithWork.has(cursor)) {
    weekStreak += 1;
    cursor -= WEEK_MS;
  }

  // Last 7 days of volume for the mini chart.
  const last7: DayBar[] = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = todayStart - i * DAY_MS;
    const dayEnd = dayStart + DAY_MS;
    let vol = 0;
    for (const s of sessions) {
      const t = s.finishedAt ?? s.startedAt;
      if (t >= dayStart && t < dayEnd) vol += sessionStats(s).volume;
    }
    last7.push({
      label: WEEKDAY[new Date(dayStart).getDay()],
      value: vol,
      isToday: i === 0,
    });
  }

  return {
    totalWorkouts: sessions.length,
    thisWeek,
    weekStreak,
    totalVolume,
    totalSets,
    last7,
  };
}

// ---------- Personal records ----------

export interface ExercisePR {
  exerciseId: string;
  name: string;
  muscle: MuscleGroup;
  /** Best estimated one-rep max (Epley) across all logged sets. */
  best1RM: number;
  /** Heaviest weight ever lifted, and the reps done at it. */
  heaviestWeight: number;
  heaviestWeightReps: number;
  /** Most reps in a single set. */
  bestReps: number;
  /** Best single-set volume (weight × reps). */
  bestSetVolume: number;
  /** When the best 1RM was hit. */
  achievedAt: number;
}

export interface Highlight {
  name: string;
  value: number;
  at: number;
}

export interface Records {
  totalPRs: number;
  heaviestLift: (Highlight & { reps: number }) | null;
  bestSessionVolume: Highlight | null;
  longestSessionMs: Highlight | null;
  exercises: ExercisePR[]; // sorted by best 1RM, strongest first
}

/** Epley estimated one-rep max. */
function oneRepMax(weight: number, reps: number): number {
  return Math.round(weight * (1 + reps / 30));
}

/** Compute all-time personal records from finished sessions. */
export function computeRecords(sessions: WorkoutSession[]): Records {
  const map = new Map<string, ExercisePR>();
  let heaviestLift: Records['heaviestLift'] = null;
  let bestSessionVolume: Highlight | null = null;
  let longestSessionMs: Highlight | null = null;

  for (const s of sessions) {
    const at = s.finishedAt ?? s.startedAt;

    const vol = sessionStats(s).volume;
    if (vol > 0 && (!bestSessionVolume || vol > bestSessionVolume.value)) {
      bestSessionVolume = { name: s.name, value: vol, at };
    }

    if (s.finishedAt) {
      const ms = s.finishedAt - s.startedAt - (s.pausedMs ?? 0);
      if (ms > 0 && (!longestSessionMs || ms > longestSessionMs.value)) {
        longestSessionMs = { name: s.name, value: ms, at };
      }
    }

    for (const ex of s.exercises) {
      for (const set of ex.sets) {
        if (!set.done) continue;
        const w = set.weight ?? 0;
        const r = set.reps ?? 0;
        if (w <= 0 || r <= 0) continue;

        const est = oneRepMax(w, r);
        const setVol = w * r;

        if (!heaviestLift || w > heaviestLift.value) {
          heaviestLift = { name: ex.name, value: w, reps: r, at };
        }

        const cur = map.get(ex.exerciseId);
        if (!cur) {
          map.set(ex.exerciseId, {
            exerciseId: ex.exerciseId,
            name: ex.name,
            muscle: ex.muscle,
            best1RM: est,
            heaviestWeight: w,
            heaviestWeightReps: r,
            bestReps: r,
            bestSetVolume: setVol,
            achievedAt: at,
          });
        } else {
          if (est > cur.best1RM) {
            cur.best1RM = est;
            cur.achievedAt = at;
          }
          if (w > cur.heaviestWeight) {
            cur.heaviestWeight = w;
            cur.heaviestWeightReps = r;
          }
          if (r > cur.bestReps) cur.bestReps = r;
          if (setVol > cur.bestSetVolume) cur.bestSetVolume = setVol;
        }
      }
    }
  }

  const exercises = [...map.values()].sort((a, b) => b.best1RM - a.best1RM);
  return {
    totalPRs: exercises.length,
    heaviestLift,
    bestSessionVolume,
    longestSessionMs,
    exercises,
  };
}
