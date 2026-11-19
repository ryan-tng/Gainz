import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Photo check-ins the user postponed with "Later". Kept on this device only
 * (not part of the cloud backup): each entry is a photo streak that still needs
 * a proof photo for a workout finished at `finishedAt`. The photo must be taken
 * within PHOTO_WINDOW_MS of finishing, or the workout doesn't count for it.
 *
 * Self-reported, like all streak credit: the window is a nudge, not security.
 */
export const PHOTO_WINDOW_MS = 2 * 60 * 60 * 1000;

const KEY = 'gainz:pendingStreakPhotos';

export interface PendingPhoto {
  streakId: string;
  streakName: string;
  friend: string;
  label: string | null;
  finishedAt: number;
}

async function readAll(): Promise<PendingPhoto[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PendingPhoto[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(list: PendingPhoto[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // best-effort
  }
}

/** Pending photos still inside their window (expired ones are dropped). */
export async function getPendingPhotos(): Promise<PendingPhoto[]> {
  const now = Date.now();
  const all = await readAll();
  const fresh = all.filter((p) => now - p.finishedAt < PHOTO_WINDOW_MS);
  if (fresh.length !== all.length) await writeAll(fresh);
  return fresh;
}

/** Add (or refresh) pending photos; one entry per streak, newest workout wins. */
export async function addPendingPhotos(items: PendingPhoto[]): Promise<void> {
  const ids = new Set(items.map((i) => i.streakId));
  const kept = (await getPendingPhotos()).filter((p) => !ids.has(p.streakId));
  await writeAll([...kept, ...items]);
}

export async function removePendingPhotos(streakIds: string[]): Promise<void> {
  const ids = new Set(streakIds);
  await writeAll((await readAll()).filter((p) => !ids.has(p.streakId)));
}

/** "1h 42m left" / "12m left". */
export function timeLeftLabel(finishedAt: number): string {
  const left = Math.max(0, PHOTO_WINDOW_MS - (Date.now() - finishedAt));
  const mins = Math.ceil(left / 60_000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
}
