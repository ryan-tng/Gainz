import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';

import type { Streak } from './social';
import { getPendingPhotos, PHOTO_WINDOW_MS } from './streakPending';

/**
 * Local notifications (scheduled on the device, no server):
 *  - rest timer finished
 *  - streak week ending soon while you're still short of your target
 *  - proof photo window about to close
 *
 * Streak reminders only use YOUR progress, which only changes through your own
 * check-ins, so they're re-synced after every check-in and stay accurate.
 * Friend-driven alerts ("Alex finished a workout") need server push (later).
 */

const SUPPORTED = Platform.OS === 'ios' || Platform.OS === 'android';
const HOUR = 3_600_000;

type Kind = 'rest' | 'streak' | 'photo';

// ---------------------------------------------------------------------------
// Preferences (per device)
// ---------------------------------------------------------------------------

export interface NotificationPrefs {
  rest: boolean;
  streaks: boolean;
}
const PREFS_KEY = 'gainz:notificationPrefs';
const ASKED_KEY = 'gainz:notificationsAsked';
const DEFAULT_PREFS: NotificationPrefs = { rest: true, streaks: true };

export async function getNotificationPrefs(): Promise<NotificationPrefs> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<NotificationPrefs>) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export async function setNotificationPrefs(prefs: NotificationPrefs): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // best-effort
  }
  if (!prefs.rest) await cancelRestDone();
  if (!prefs.streaks) await cancelKinds(['streak', 'photo']);
}

// ---------------------------------------------------------------------------
// Setup + permission
// ---------------------------------------------------------------------------

let initialized = false;

/** Call once at app start. */
export function initNotifications(): void {
  if (!SUPPORTED || initialized) return;
  initialized = true;
  Notifications.setNotificationHandler({
    handleNotification: async (n) => {
      // While the app is open the rest timer rings in-app, so skip the banner.
      const kind = (n.request.content.data as { kind?: Kind } | undefined)?.kind;
      const show = kind !== 'rest';
      return { shouldShowBanner: show, shouldShowList: show, shouldPlaySound: show, shouldSetBadge: false };
    },
  });
  if (Platform.OS === 'android') {
    void Notifications.setNotificationChannelAsync('rest', {
      name: 'Rest timer',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    }).catch(() => {});
    void Notifications.setNotificationChannelAsync('streaks', {
      name: 'Streak reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    }).catch(() => {});
  }
}

async function isGranted(): Promise<boolean> {
  if (!SUPPORTED) return false;
  try {
    const p = await Notifications.getPermissionsAsync();
    return p.granted || p.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  } catch {
    return false;
  }
}

/**
 * Ask for permission the first time it's useful (first rest timer, first
 * streak). Never re-prompts automatically after that; Settings can re-ask.
 */
export async function askOnce(): Promise<boolean> {
  if (!SUPPORTED) return false;
  if (await isGranted()) return true;
  try {
    if (await AsyncStorage.getItem(ASKED_KEY)) return false;
    await AsyncStorage.setItem(ASKED_KEY, '1');
    const res = await Notifications.requestPermissionsAsync();
    return res.granted;
  } catch {
    return false;
  }
}

/**
 * From the Settings toggles: request permission, and if the OS won't show the
 * prompt anymore (previously denied), report that so the UI can send the user
 * to the system settings.
 */
export async function requestFromSettings(): Promise<'granted' | 'denied'> {
  if (!SUPPORTED) return 'denied';
  if (await isGranted()) return 'granted';
  try {
    const res = await Notifications.requestPermissionsAsync();
    return res.granted ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

export const openSystemSettings = () => {
  void Linking.openSettings().catch(() => {});
};

async function cancelKinds(kinds: Kind[]): Promise<void> {
  if (!SUPPORTED) return;
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      all
        .filter((n) => kinds.includes((n.content.data as { kind?: Kind } | undefined)?.kind as Kind))
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Rest timer
// ---------------------------------------------------------------------------

let restId: string | null = null;
let restSeq = 0;

/**
 * Schedule (or move) the "rest's over" notification `seconds` from now.
 * `withSound` follows the app's "Alarm sound" setting. Note: notification
 * sounds obey the phone's silent switch (the in-app alarm doesn't).
 */
export async function scheduleRestDone(seconds: number, withSound = true): Promise<void> {
  if (!SUPPORTED) return;
  const seq = ++restSeq;
  await cancelRestDone(false);
  if (seconds < 1) return;
  const prefs = await getNotificationPrefs();
  if (!prefs.rest) return;
  if (!(await askOnce())) return;
  if (seq !== restSeq) return; // a newer start/skip happened while we awaited
  try {
    restId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Rest’s over 💪',
        body: 'Time for your next set.',
        sound: withSound ? 'default' : false,
        data: { kind: 'rest' },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.round(seconds), channelId: 'rest' },
    });
  } catch {
    restId = null;
  }
}

export async function cancelRestDone(bump = true): Promise<void> {
  if (!SUPPORTED) return;
  if (bump) restSeq++;
  const id = restId;
  restId = null;
  if (id) await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}

// ---------------------------------------------------------------------------
// Streak + photo reminders
// ---------------------------------------------------------------------------

let syncChain: Promise<void> = Promise.resolve();

/**
 * Replace all scheduled streak/photo reminders based on current progress.
 * Called whenever streaks are (re)loaded. Serialized so overlapping calls
 * can't double-schedule.
 */
export function syncStreakReminders(streaks: Streak[]): Promise<void> {
  syncChain = syncChain.then(() => doSync(streaks)).catch(() => {});
  return syncChain;
}

async function doSync(streaks: Streak[]): Promise<void> {
  if (!SUPPORTED) return;
  await cancelKinds(['streak', 'photo']);
  const prefs = await getNotificationPrefs();
  if (!prefs.streaks || !(await isGranted())) return;

  const now = Date.now();
  const schedule = (at: number, title: string, body: string, kind: Kind, data: Record<string, string>) =>
    Notifications.scheduleNotificationAsync({
      content: { title, body, sound: 'default', data: { kind, ...data } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: 'streaks' },
    }).catch(() => {});

  const jobs: Promise<unknown>[] = [];
  for (const s of streaks) {
    const p = s.progress;
    if (!p || s.lost || s.status !== 'active') continue;
    const left = p.me.target - p.me.count;
    if (left <= 0) continue;
    const friend = s.friend.profile.username;
    const more = `${left} more workout${left === 1 ? '' : 's'}`;
    const keep = p.consecutive > 0 ? `to keep your ${p.consecutive}-week streak` : 'to keep the streak going';
    const tomorrow = p.cycleEnd - 24 * HOUR;
    const soon = p.cycleEnd - 3 * HOUR;
    if (tomorrow > now + 60_000) {
      jobs.push(
        schedule(tomorrow, `⏳ Streak with @${friend} ends tomorrow`, `You need ${more} ${keep}.`, 'streak', {
          streakId: s.id,
        }),
      );
    }
    if (soon > now + 60_000) {
      jobs.push(
        schedule(soon, `⏳ 3 hours left: ${s.name}`, `${more} or your streak with @${friend} ends.`, 'streak', {
          streakId: s.id,
        }),
      );
    }
  }

  // Proof photos postponed with "Later": remind 30 minutes before the window closes.
  for (const pend of await getPendingPhotos()) {
    const at = pend.finishedAt + PHOTO_WINDOW_MS - 30 * 60_000;
    if (at > now + 30_000) {
      jobs.push(
        schedule(at, '📸 Snap your proof photo', `30 minutes left to count your workout for ${pend.streakName}.`, 'photo', {
          streakId: pend.streakId,
        }),
      );
    }
  }
  await Promise.all(jobs);
}

/** Remove every streak/photo reminder (sign-out). */
export function clearStreakReminders(): Promise<void> {
  syncChain = syncChain.then(() => cancelKinds(['streak', 'photo'])).catch(() => {});
  return syncChain;
}

/** Streak id a tapped notification points to (to open that streak). */
export function streakIdFrom(response: Notifications.NotificationResponse): string | null {
  const d = response.notification.request.content.data as { kind?: Kind; streakId?: string } | undefined;
  return d && (d.kind === 'streak' || d.kind === 'photo') && d.streakId ? d.streakId : null;
}
