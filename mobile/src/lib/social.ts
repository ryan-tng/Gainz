import { syncStreakReminders } from './notifications';
import { supabase } from './supabase';

export interface Profile {
  user_id: string;
  username: string;
  display_name: string | null;
}

/** Handle rules must match the DB check: 3–20 chars, lowercase a–z 0–9 _. */
export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

/** The signed-in user's social profile, or null if they haven't picked a handle. */
export async function getMyProfile(): Promise<Profile | null> {
  if (!supabase) return null;
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, username, display_name')
    .eq('user_id', uid)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Profile) ?? null;
}

/** Claim or change the user's handle. Throws a friendly error if taken/invalid. */
export async function claimUsername(username: string, displayName?: string | null): Promise<void> {
  if (!supabase) throw new Error('Cloud accounts are not configured.');
  const uname = username.trim().toLowerCase();
  if (!USERNAME_RE.test(uname)) {
    throw new Error('Usernames are 3–20 characters: lowercase letters, numbers, and underscores.');
  }
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error('Please sign in.');
  const { error } = await supabase
    .from('profiles')
    .upsert(
      { user_id: uid, username: uname, display_name: displayName?.trim() || null },
      { onConflict: 'user_id' },
    );
  if (error) {
    if (error.code === '23505' || /duplicate|unique/i.test(error.message)) {
      throw new Error('That username is taken. Try another.');
    }
    throw new Error(error.message);
  }
}

/** Find users by username prefix (rate-limited server-side). */
export async function searchUsers(q: string): Promise<Profile[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('search_users', { q: q.trim() });
  if (error) throw new Error(error.message);
  return (data ?? []) as Profile[];
}

// ---------------------------------------------------------------------------
// Friend requests & friendships
// ---------------------------------------------------------------------------

export interface FriendRequest {
  id: string;
  user: Profile; // the other party (sender for incoming, recipient for outgoing)
  message: string | null;
  created_at: string;
}

async function myId(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

async function profilesByIds(ids: string[]): Promise<Record<string, Profile>> {
  if (!supabase || ids.length === 0) return {};
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, username, display_name')
    .in('user_id', ids);
  if (error) throw new Error(error.message);
  const map: Record<string, Profile> = {};
  for (const p of (data ?? []) as Profile[]) map[p.user_id] = p;
  return map;
}

async function listRequests(direction: 'incoming' | 'outgoing'): Promise<FriendRequest[]> {
  if (!supabase) return [];
  const uid = await myId();
  if (!uid) return [];
  const mineCol = direction === 'incoming' ? 'to_user' : 'from_user';
  const otherCol = direction === 'incoming' ? 'from_user' : 'to_user';
  const { data, error } = await supabase
    .from('friend_requests')
    .select('id, from_user, to_user, message, created_at')
    .eq(mineCol, uid)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Record<string, string | null>[];
  const profs = await profilesByIds(rows.map((r) => r[otherCol] as string));
  return rows
    .map((r) => {
      const other = profs[r[otherCol] as string];
      return other
        ? { id: r.id as string, user: other, message: r.message, created_at: r.created_at as string }
        : null;
    })
    .filter((x): x is FriendRequest => x !== null);
}

export const listIncomingRequests = () => listRequests('incoming');
export const listOutgoingRequests = () => listRequests('outgoing');

export async function listFriends(): Promise<Profile[]> {
  if (!supabase) return [];
  const uid = await myId();
  if (!uid) return [];
  const { data, error } = await supabase
    .from('friendships')
    .select('user_lo, user_hi')
    .or(`user_lo.eq.${uid},user_hi.eq.${uid}`);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { user_lo: string; user_hi: string }[];
  const otherIds = rows.map((r) => (r.user_lo === uid ? r.user_hi : r.user_lo));
  const profs = await profilesByIds(otherIds);
  return otherIds.map((id) => profs[id]).filter((p): p is Profile => !!p);
}

export async function getIncomingRequestCount(): Promise<number> {
  if (!supabase) return 0;
  const uid = await myId();
  if (!uid) return 0;
  const { count, error } = await supabase
    .from('friend_requests')
    .select('*', { count: 'exact', head: true })
    .eq('to_user', uid)
    .eq('status', 'pending');
  if (error) return 0;
  return count ?? 0;
}

const rpc = async (fn: string, args: Record<string, unknown>) => {
  if (!supabase) throw new Error('Cloud accounts are not configured.');
  const { error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
};

export const sendFriendRequest = (username: string, message?: string) =>
  rpc('send_friend_request', {
    p_to_username: username.trim().toLowerCase(),
    p_message: message?.trim() || null,
  });
export const respondFriendRequest = (id: string, action: 'accept' | 'decline') =>
  rpc('respond_friend_request', { p_request_id: id, p_action: action });
export const cancelFriendRequest = (id: string) =>
  rpc('cancel_friend_request', { p_request_id: id });
export const removeFriend = (otherId: string) => rpc('remove_friend', { p_other: otherId });
export const blockUser = (otherId: string) => rpc('block_user', { p_other: otherId });

// ---------------------------------------------------------------------------
// Streaks
// ---------------------------------------------------------------------------

export type StreakStatus = 'pending' | 'active' | 'ended';
export type OnMiss = 'reset' | 'pause';

export interface StreakProgress {
  cycleIndex: number; // 0-based week from started_at
  cycleStart: number; // ms
  cycleEnd: number; // ms
  me: { count: number; target: number; met: boolean };
  friend: { count: number; target: number; met: boolean };
  bothMetThisCycle: boolean;
  consecutive: number; // finished weeks in a row both hit the target
  /** Under 2 days left in the week and someone is still behind. */
  atRisk: boolean;
}

export interface Streak {
  id: string;
  name: string;
  creator: string;
  status: StreakStatus;
  on_miss: OnMiss;
  started_at: string | null;
  created_at: string;
  photo_required: boolean;
  ended_reason: string | null;
  ended_at: string | null;
  lost_at_count: number | null;
  /** Ended because someone missed a week (shown for 7 days as "Lost at N"). */
  lost: boolean;
  me: { target: number; accepted: boolean; shareLabels: boolean };
  friend: { profile: Profile; target: number; accepted: boolean; shareLabels: boolean };
  invitedPending: boolean; // I'm the invitee and haven't accepted yet
  waitingOnFriend: boolean; // I accepted; the friend hasn't
  progress?: StreakProgress; // present for active streaks
}

export type Reaction = 'fire' | 'muscle';

export interface ActivityEvent {
  id: string;
  mine: boolean;
  username: string; // "You" or the friend's handle
  delta: number; // +1 credit, -1 correction/skip
  source: 'app' | 'manual' | 'photo' | 'skip';
  note: string | null;
  label: string | null;
  created_at: string;
  /** Signed URL for a proof photo (null once expired after 7 days). */
  photoUrl: string | null;
  hadPhoto: boolean;
  reactions: { fire: number; muscle: number };
  myReaction: Reaction | null;
}

interface StreakRow {
  id: string;
  name: string;
  creator: string;
  status: StreakStatus;
  on_miss: OnMiss;
  started_at: string | null;
  created_at: string;
  photo_required: boolean;
  ended_reason: string | null;
  ended_at: string | null;
  lost_at_count: number | null;
}
interface MemberRow {
  streak_id: string;
  user_id: string;
  target: number;
  accepted: boolean;
  share_labels: boolean;
}
interface CheckinRow {
  streak_id: string;
  user_id: string;
  cycle_index: number;
  delta: number;
}

const DAY_MS = 86_400_000;

/** Non-negative count for one member in one cycle (sum of +1/-1 events). */
function countFor(rows: CheckinRow[], streakId: string, userId: string, cycle: number): number {
  let n = 0;
  for (const r of rows) {
    if (r.streak_id === streakId && r.user_id === userId && r.cycle_index === cycle) n += r.delta;
  }
  return Math.max(0, n);
}

function computeProgress(
  s: StreakRow,
  uid: string,
  friendId: string,
  myTarget: number,
  friendTarget: number,
  rows: CheckinRow[],
): StreakProgress | undefined {
  if (s.status !== 'active' || !s.started_at) return undefined;
  const started = new Date(s.started_at).getTime();
  const cycleMs = 7 * DAY_MS;
  const cycleIndex = Math.max(0, Math.floor((Date.now() - started) / cycleMs));
  const cycleStart = started + cycleIndex * cycleMs;

  const myCount = countFor(rows, s.id, uid, cycleIndex);
  const frCount = countFor(rows, s.id, friendId, cycleIndex);

  // Consecutive completed cycles both passed (targets fixed in v1).
  const passed: boolean[] = [];
  for (let i = 0; i < cycleIndex; i++) {
    passed.push(
      countFor(rows, s.id, uid, i) >= myTarget && countFor(rows, s.id, friendId, i) >= friendTarget,
    );
  }
  let consecutive: number;
  if (s.on_miss === 'pause') {
    consecutive = passed.filter(Boolean).length; // misses freeze (don't reset)
  } else {
    consecutive = 0;
    for (let i = passed.length - 1; i >= 0 && passed[i]; i--) consecutive++;
  }

  const cycleEnd = cycleStart + cycleMs;
  const bothMet = myCount >= myTarget && frCount >= friendTarget;
  return {
    cycleIndex,
    cycleStart,
    cycleEnd,
    me: { count: myCount, target: myTarget, met: myCount >= myTarget },
    friend: { count: frCount, target: friendTarget, met: frCount >= friendTarget },
    bothMetThisCycle: bothMet,
    consecutive,
    atRisk: !bothMet && cycleEnd - Date.now() < 2 * DAY_MS,
  };
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "resets Thu", or when at risk "ends today" / "ends tomorrow" / "ends in 5h". */
export function endsLabel(p: StreakProgress): string {
  const left = p.cycleEnd - Date.now();
  if (!p.atRisk) return `resets ${WEEKDAYS[new Date(p.cycleEnd).getDay()]}`;
  if (left < 12 * 3_600_000) return `ends in ${Math.max(1, Math.ceil(left / 3_600_000))}h`;
  const endDay = new Date(p.cycleEnd).toDateString();
  return endDay === new Date().toDateString() ? 'ends today' : 'ends tomorrow';
}

const STREAK_COLS =
  'id, name, creator, status, on_miss, started_at, created_at, photo_required, ended_reason, ended_at, lost_at_count';

/**
 * Streaks the user is part of: pending + active, plus streaks lost in the last
 * 7 days (shown as "Lost at N"). Lost streaks are settled server-side first.
 */
export async function listStreaks(): Promise<Streak[]> {
  if (!supabase) return [];
  const uid = await myId();
  if (!uid) return [];
  await supabase.rpc('settle_my_streaks'); // best-effort: ends streaks with a missed week

  const [live, lost] = await Promise.all([
    supabase.from('streaks').select(STREAK_COLS).neq('status', 'ended').order('created_at', { ascending: false }),
    supabase
      .from('streaks')
      .select(STREAK_COLS)
      .eq('status', 'ended')
      .eq('ended_reason', 'lost')
      .gt('ended_at', new Date(Date.now() - 7 * DAY_MS).toISOString())
      .order('ended_at', { ascending: false }),
  ]);
  if (live.error) throw new Error(live.error.message);
  const streaks = [...((live.data ?? []) as StreakRow[]), ...((lost.data ?? []) as StreakRow[])];
  if (streaks.length === 0) return [];

  const { data: mData, error: mErr } = await supabase
    .from('streak_members')
    .select('streak_id, user_id, target, accepted, share_labels')
    .in('streak_id', streaks.map((s) => s.id));
  if (mErr) throw new Error(mErr.message);
  const members = (mData ?? []) as MemberRow[];
  const profs = await profilesByIds(members.filter((m) => m.user_id !== uid).map((m) => m.user_id));

  // Check-ins for active streaks, to derive progress.
  const activeIds = streaks.filter((s) => s.status === 'active').map((s) => s.id);
  let checkins: CheckinRow[] = [];
  if (activeIds.length) {
    const { data: cData, error: cErr } = await supabase
      .from('streak_checkins')
      .select('streak_id, user_id, cycle_index, delta')
      .in('streak_id', activeIds);
    if (cErr) throw new Error(cErr.message);
    checkins = (cData ?? []) as CheckinRow[];
  }

  const out: Streak[] = [];
  for (const s of streaks) {
    const mine = members.find((m) => m.streak_id === s.id && m.user_id === uid);
    const other = members.find((m) => m.streak_id === s.id && m.user_id !== uid);
    const otherProfile = other && profs[other.user_id];
    if (!mine || !other || !otherProfile) continue;
    out.push({
      ...s,
      me: { target: mine.target, accepted: mine.accepted, shareLabels: mine.share_labels },
      friend: {
        profile: otherProfile,
        target: other.target,
        accepted: other.accepted,
        shareLabels: other.share_labels,
      },
      photo_required: !!s.photo_required,
      lost: s.status === 'ended' && s.ended_reason === 'lost',
      invitedPending: s.status === 'pending' && !mine.accepted,
      waitingOnFriend: s.status === 'pending' && mine.accepted && !other.accepted,
      progress: computeProgress(s, uid, other.user_id, mine.target, other.target, checkins),
    });
  }
  void syncStreakReminders(out); // keep "streak ends soon" reminders current
  return out;
}

/** Reload streaks just to refresh the scheduled reminders (after a check-in, on app open). */
export async function refreshStreakReminders(): Promise<void> {
  try {
    await listStreaks();
  } catch {
    // offline etc. — reminders stay as last scheduled
  }
}

export const createStreak = (
  name: string,
  friendId: string,
  myTarget: number,
  friendTarget: number,
  photoRequired: boolean,
) =>
  rpc('create_streak', {
    p_name: name.trim(),
    p_friend: friendId,
    p_my_target: myTarget,
    p_friend_target: friendTarget,
    p_photo: photoRequired,
  });

export const respondStreakInvite = (streakId: string, accept: boolean) =>
  rpc('respond_streak_invite', { p_streak: streakId, p_accept: accept });
/** Cancel a pending invite you sent. Active streaks can't be left; they end when lost. */
export const cancelStreakInvite = (streakId: string) => rpc('leave_streak', { p_streak: streakId });

/** Active streaks this workout could count toward (shown in the post-workout check-in). */
export async function listCheckinTargets(): Promise<Streak[]> {
  const all = await listStreaks();
  return all.filter((s) => s.status === 'active' && s.me.accepted && !!s.progress);
}

export const checkInStreak = (streakId: string, label?: string | null) =>
  rpc('check_in', { p_streak: streakId, p_label: label ?? null });
/** Undo this workout's credit for one streak (post-workout Edit). */
export const skipCheckin = (streakId: string) => rpc('skip_checkin', { p_streak: streakId });

// Minimal base64 decoder (no dependency) for uploading camera photos.
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/^data:[^,]*,/, '').replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = B64.indexOf(clean[i]);
    const b = B64.indexOf(clean[i + 1]);
    const c = i + 2 < clean.length ? B64.indexOf(clean[i + 2]) : -1;
    const d = i + 3 < clean.length ? B64.indexOf(clean[i + 3]) : -1;
    out[o++] = (a << 2) | (b >> 4);
    if (c >= 0) out[o++] = ((b & 15) << 4) | (c >> 2);
    if (d >= 0) out[o++] = ((c & 3) << 6) | d;
  }
  return out.subarray(0, o);
}

/**
 * Upload one in-app camera photo and use it as proof for each photo streak.
 * The photo is stored once per streak (each streak's folder is readable only
 * by its two members). Returns the streak ids that were counted.
 */
export async function checkInWithPhoto(
  streakIds: string[],
  label: string | null,
  base64: string,
): Promise<{ counted: string[]; failed: string[] }> {
  if (!supabase) throw new Error('Cloud accounts are not configured.');
  const uid = await myId();
  if (!uid) throw new Error('Please sign in.');
  // Supabase's React Native upload expects a plain ArrayBuffer (no shared view).
  const view = base64ToBytes(base64);
  const bytes = view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer;
  const counted: string[] = [];
  const failed: string[] = [];
  for (const sid of streakIds) {
    const path = `${uid}/${sid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const up = await supabase.storage
      .from('streak-photos')
      .upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
    if (up.error) {
      failed.push(sid);
      continue;
    }
    const { error } = await supabase.rpc('check_in_photo', {
      p_streak: sid,
      p_label: label,
      p_photo_path: path,
    });
    if (error) failed.push(sid);
    else counted.push(sid);
  }
  return { counted, failed };
}

export const reactCheckin = (checkinId: string, emoji: Reaction | null) =>
  rpc('react_checkin', { p_checkin: checkinId, p_emoji: emoji });
export const reportPhoto = (checkinId: string, reason: string) =>
  rpc('report_photo', { p_checkin: checkinId, p_reason: reason });

/** One streak with its computed progress (reuses listStreaks). */
export async function getStreak(id: string): Promise<Streak | null> {
  const all = await listStreaks();
  return all.find((s) => s.id === id) ?? null;
}

/** The check-in + correction events for a cycle, newest first. */
export async function getStreakActivity(streakId: string, cycleIndex: number): Promise<ActivityEvent[]> {
  if (!supabase) return [];
  const uid = await myId();
  const { data, error } = await supabase
    .from('streak_checkins')
    .select('id, user_id, delta, source, note, label, created_at, photo_path')
    .eq('streak_id', streakId)
    .eq('cycle_index', cycleIndex)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as {
    id: string;
    user_id: string;
    delta: number;
    source: ActivityEvent['source'];
    note: string | null;
    label: string | null;
    created_at: string;
    photo_path: string | null;
  }[];
  const others = [...new Set(rows.filter((r) => r.user_id !== uid).map((r) => r.user_id))];

  // Photos: short-lived signed links. Storage refuses anything older than 7 days.
  const paths = rows.map((r) => r.photo_path).filter((p): p is string => !!p);
  const urlByPath: Record<string, string> = {};
  const [profs, signed, reacts] = await Promise.all([
    profilesByIds(others),
    paths.length
      ? supabase.storage.from('streak-photos').createSignedUrls(paths, 3600)
      : Promise.resolve({ data: [], error: null }),
    rows.length
      ? supabase.from('streak_reactions').select('checkin_id, user_id, emoji').in('checkin_id', rows.map((r) => r.id))
      : Promise.resolve({ data: [], error: null }),
  ]);
  for (const s of (signed.data ?? []) as { path: string | null; signedUrl: string | null; error: string | null }[]) {
    if (s.path && s.signedUrl && !s.error) urlByPath[s.path] = s.signedUrl;
  }
  const reactRows = (reacts.data ?? []) as { checkin_id: string; user_id: string; emoji: Reaction }[];

  return rows.map((r) => {
    const mineR = reactRows.filter((x) => x.checkin_id === r.id);
    return {
      id: r.id,
      mine: r.user_id === uid,
      username: r.user_id === uid ? 'You' : profs[r.user_id]?.username ?? 'friend',
      delta: r.delta,
      source: r.source,
      note: r.note,
      label: r.label,
      created_at: r.created_at,
      hadPhoto: !!r.photo_path,
      photoUrl: r.photo_path ? urlByPath[r.photo_path] ?? null : null,
      reactions: {
        fire: mineR.filter((x) => x.emoji === 'fire').length,
        muscle: mineR.filter((x) => x.emoji === 'muscle').length,
      },
      myReaction: mineR.find((x) => x.user_id === uid)?.emoji ?? null,
    };
  });
}

export const correctCheckin = (streakId: string, delta: 1 | -1, note: string) =>
  rpc('correct_checkin', { p_streak: streakId, p_delta: delta, p_note: note.trim() });
export const setShareLabels = (streakId: string, on: boolean) =>
  rpc('set_share_labels', { p_streak: streakId, p_on: on });

export async function getPendingStreakInviteCount(): Promise<number> {
  if (!supabase) return 0;
  const uid = await myId();
  if (!uid) return 0;
  const { data, error } = await supabase
    .from('streak_members')
    .select('streak_id, streaks!inner(status)')
    .eq('user_id', uid)
    .eq('accepted', false)
    .eq('streaks.status', 'pending');
  if (error) return 0;
  return (data ?? []).length;
}

/** Combined badge count for the Social entry: friend requests + streak invites. */
export async function getSocialPendingCount(): Promise<number> {
  const [requests, invites] = await Promise.all([
    getIncomingRequestCount(),
    getPendingStreakInviteCount(),
  ]);
  return requests + invites;
}
