export function formatDate(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatDuration(startMs: number, endMs: number): string {
  const mins = Math.max(0, Math.round((endMs - startMs) / 60000));
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function formatVolume(lb: number): string {
  if (lb >= 1000) return `${(lb / 1000).toFixed(1)}k lb`;
  return `${Math.round(lb)} lb`;
}

/** Start of the current week (Monday) in epoch ms. */
export function startOfWeek(now = Date.now()): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7; // Mon=0..Sun=6
  d.setDate(d.getDate() - day);
  return d.getTime();
}
