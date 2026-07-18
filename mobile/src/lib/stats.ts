import { startOfDay, startOfWeek } from './format';
import { sessionStats, type WorkoutSession } from './types';

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
