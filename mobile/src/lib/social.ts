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
  cycleIndex: number; // 0-based cycle from started_at
  cycleStart: number; // ms
  cycleEnd: number; // ms
  me: { count: number; target: number; met: boolean };
  friend: { count: number; target: number; met: boolean };
  bothMetThisCycle: boolean;
  consecutive: number; // completed cycles both passed (reset/pause aware)
}

export interface Streak {
  id: string;
  name: string;
  creator: string;
  status: StreakStatus;
  on_miss: OnMiss;
  started_at: string | null;
  created_at: string;
  me: { target: number; accepted: boolean; shareLabels: boolean };
  friend: { profile: Profile; target: number; accepted: boolean; shareLabels: boolean };
  invitedPending: boolean; // I'm the invitee and haven't accepted yet
  waitingOnFriend: boolean; // I accepted; the friend hasn't
  progress?: StreakProgress; // present for active streaks
}

export interface ActivityEvent {
  id: string;
  mine: boolean;
  username: string; // "You" or the friend's handle
  delta: number; // +1 credit, -1 correction
  source: 'app' | 'manual';
  note: string | null;
  label: string | null;
  created_at: string;
}

interface StreakRow {
  id: string;
  name: string;
  creator: string;
  status: StreakStatus;
  on_miss: OnMiss;
  started_at: string | null;
  created_at: string;
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

  return {
    cycleIndex,
    cycleStart,
    cycleEnd: cycleStart + cycleMs,
    me: { count: myCount, target: myTarget, met: myCount >= myTarget },
    friend: { count: frCount, target: friendTarget, met: frCount >= friendTarget },
    bothMetThisCycle: myCount >= myTarget && frCount >= friendTarget,
    consecutive,
  };
}

/** All non-ended streaks the user is part of, with the friend's profile joined. */
export async function listStreaks(): Promise<Streak[]> {
  if (!supabase) return [];
  const uid = await myId();
  if (!uid) return [];
  const { data: sData, error: sErr } = await supabase
    .from('streaks')
    .select('id, name, creator, status, on_miss, started_at, created_at')
    .neq('status', 'ended')
    .order('created_at', { ascending: false });
  if (sErr) throw new Error(sErr.message);
  const streaks = (sData ?? []) as StreakRow[];
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
      invitedPending: s.status === 'pending' && !mine.accepted,
      waitingOnFriend: s.status === 'pending' && mine.accepted && !other.accepted,
      progress: computeProgress(s, uid, other.user_id, mine.target, other.target, checkins),
    });
  }
  return out;
}

export const createStreak = (
  name: string,
  friendId: string,
  myTarget: number,
  friendTarget: number,
  onMiss: OnMiss,
) =>
  rpc('create_streak', {
    p_name: name.trim(),
    p_friend: friendId,
    p_my_target: myTarget,
    p_friend_target: friendTarget,
    p_on_miss: onMiss,
  });

export const respondStreakInvite = (streakId: string, accept: boolean) =>
  rpc('respond_streak_invite', { p_streak: streakId, p_accept: accept });
export const leaveStreak = (streakId: string) => rpc('leave_streak', { p_streak: streakId });

/**
 * Append a self-reported check-in to every active streak the user is in.
 * Called when a workout session is completed. Best-effort — never blocks or
 * fails the workout finish.
 */
export async function checkInActiveStreaks(label?: string): Promise<void> {
  if (!supabase) return;
  try {
    const streaks = await listStreaks();
    const active = streaks.filter((s) => s.status === 'active' && s.me.accepted);
    await Promise.all(
      active.map((s) => supabase!.rpc('check_in', { p_streak: s.id, p_label: label ?? null })),
    );
  } catch {
    // Streak credit must never block finishing a workout.
  }
}

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
    .select('id, user_id, delta, source, note, label, created_at')
    .eq('streak_id', streakId)
    .eq('cycle_index', cycleIndex)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as {
    id: string;
    user_id: string;
    delta: number;
    source: 'app' | 'manual';
    note: string | null;
    label: string | null;
    created_at: string;
  }[];
  const others = [...new Set(rows.filter((r) => r.user_id !== uid).map((r) => r.user_id))];
  const profs = await profilesByIds(others);
  return rows.map((r) => ({
    id: r.id,
    mine: r.user_id === uid,
    username: r.user_id === uid ? 'You' : profs[r.user_id]?.username ?? 'friend',
    delta: r.delta,
    source: r.source,
    note: r.note,
    label: r.label,
    created_at: r.created_at,
  }));
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
