import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBackground } from '@/components/AppBackground';
import { AppButton } from '@/components/ui';
import { Radius, Spacing, type Palette } from '@/constants/theme';
import { confirmAsync, notify } from '@/lib/confirm';
import { formatDate } from '@/lib/format';
import {
  blockUser,
  cancelFriendRequest,
  claimUsername,
  getMyProfile,
  leaveStreak,
  listFriends,
  listIncomingRequests,
  listOutgoingRequests,
  listStreaks,
  removeFriend,
  respondFriendRequest,
  respondStreakInvite,
  searchUsers,
  sendFriendRequest,
  USERNAME_RE,
  type FriendRequest,
  type Profile,
  type Streak,
} from '@/lib/social';
import { useTheme, useThemedStyles } from '@/store/theme';

export default function SocialScreen() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [handle, setHandle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setProfile(await getMyProfile());
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load your profile.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const normalized = handle.trim().toLowerCase();
  const valid = USERNAME_RE.test(normalized);

  const claim = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await claimUsername(normalized);
      setProfile(await getMyProfile());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not set your username.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: 'transparent' }]} edges={['top', 'bottom']}>
      <AppBackground />
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={16} style={styles.side}>
          <Ionicons name="chevron-back" size={26} color={palette.fg} />
        </Pressable>
        <Text style={styles.topTitle}>Social</Text>
        <View style={styles.side} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.accent} />
        </View>
      ) : !profile ? (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={8}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.logo}>
              <Ionicons name="at-outline" size={30} color={palette.accent} />
            </View>
            <Text style={styles.headline}>Pick a username</Text>
            <Text style={styles.sub}>
              Your username is how friends find you. 3–20 lowercase letters, numbers, or underscores.
              You can change it later.
            </Text>
            <View style={styles.handleRow}>
              <Text style={styles.at}>@</Text>
              <TextInput
                style={styles.handleInput}
                value={handle}
                onChangeText={(t) => setHandle(t.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())}
                placeholder="yourname"
                placeholderTextColor={palette.muted}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                maxLength={20}
              />
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <AppButton
              label={busy ? 'Saving…' : 'Claim username'}
              icon="checkmark"
              onPress={claim}
              disabled={!valid || busy}
              style={{ marginTop: Spacing.five }}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        <FriendsHome profile={profile} />
      )}
    </SafeAreaView>
  );
}

function FriendsHome({ profile }: { profile: Profile }) {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [tab, setTab] = useState<'friends' | 'requests' | 'streaks'>('friends');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [friends, setFriends] = useState<Profile[]>([]);
  const [incoming, setIncoming] = useState<FriendRequest[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequest[]>([]);
  const [streaks, setStreaks] = useState<Streak[]>([]);

  const refresh = useCallback(async () => {
    try {
      const [f, inc, out, st] = await Promise.all([
        listFriends(),
        listIncomingRequests(),
        listOutgoingRequests(),
        listStreaks(),
      ]);
      setFriends(f);
      setIncoming(inc);
      setOutgoing(out);
      setStreaks(st);
    } catch {
      // transient; the lists just won't refresh
    }
  }, []);

  // Refresh whenever the screen regains focus (e.g. returning from New streak).
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const friendIds = new Set(friends.map((f) => f.user_id));
  const outgoingIds = new Set(outgoing.map((o) => o.user.user_id));

  const runSearch = async () => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      return;
    }
    setSearching(true);
    try {
      setResults(await searchUsers(q));
    } catch (e) {
      notify('Search failed', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSearching(false);
    }
  };

  const guard = async (fn: () => Promise<void>, failTitle: string) => {
    try {
      await fn();
      await refresh();
    } catch (e) {
      notify(failTitle, e instanceof Error ? e.message : 'Please try again.');
    }
  };

  const add = (u: Profile) =>
    guard(async () => {
      await sendFriendRequest(u.username);
      notify('Request sent', `Friend request sent to @${u.username}.`);
    }, 'Could not send request');

  const removeFriendFlow = async (u: Profile) => {
    if (
      await confirmAsync({
        title: `Remove @${u.username}?`,
        message: 'This ends your friendship and any shared streaks with them.',
        confirmText: 'Remove',
        destructive: true,
      })
    ) {
      void guard(() => removeFriend(u.user_id), 'Could not remove friend');
    }
  };

  const blockFlow = async (u: Profile) => {
    if (
      await confirmAsync({
        title: `Block @${u.username}?`,
        message: 'They can no longer send you requests or share streaks with you.',
        confirmText: 'Block',
        destructive: true,
      })
    ) {
      void guard(() => blockUser(u.user_id), 'Could not block user');
    }
  };

  const leaveStreakFlow = async (s: Streak) => {
    const isInvite = s.invitedPending;
    if (
      await confirmAsync({
        title: isInvite ? 'Decline streak?' : 'Leave streak?',
        message: isInvite
          ? `Decline the "${s.name}" streak with @${s.friend.profile.username}?`
          : `Leaving "${s.name}" ends it for both you and @${s.friend.profile.username}.`,
        confirmText: isInvite ? 'Decline' : 'Leave',
        destructive: true,
      })
    ) {
      void guard(() => leaveStreak(s.id), 'Could not update streak');
    }
  };

  const renderSearchResult = (u: Profile) => {
    const already = friendIds.has(u.user_id);
    const pending = outgoingIds.has(u.user_id);
    return (
      <View key={u.user_id} style={styles.row}>
        <Avatar palette={palette} />
        <View style={{ flex: 1 }}>
          <Text style={styles.rowName}>@{u.username}</Text>
          {u.display_name ? <Text style={styles.rowMeta}>{u.display_name}</Text> : null}
        </View>
        {already ? (
          <Text style={styles.tag}>Friends</Text>
        ) : pending ? (
          <Text style={styles.tag}>Pending</Text>
        ) : (
          <Pressable style={styles.addBtn} onPress={() => add(u)} hitSlop={6}>
            <Ionicons name="person-add" size={16} color={palette.onAccent} />
            <Text style={styles.addBtnText}>Add</Text>
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={8}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.youAre}>
          You are <Text style={{ color: palette.accent, fontWeight: '800' }}>@{profile.username}</Text>
        </Text>

        {/* Add by username */}
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={palette.muted} />
          <TextInput
            style={styles.search}
            value={query}
            onChangeText={(t) => {
              setQuery(t);
              if (t.trim().length < 2) setResults(null);
            }}
            onSubmitEditing={runSearch}
            placeholder="Add a friend by username"
            placeholderTextColor={palette.muted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {query ? (
            <Pressable
              onPress={() => {
                setQuery('');
                setResults(null);
              }}
              hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={palette.muted} />
            </Pressable>
          ) : null}
        </View>

        {searching ? <ActivityIndicator color={palette.accent} style={{ marginTop: Spacing.three }} /> : null}
        {results !== null && !searching ? (
          results.length === 0 ? (
            <Text style={styles.hint}>No users found for “{query.trim()}”.</Text>
          ) : (
            <View style={styles.block}>{results.map(renderSearchResult)}</View>
          )
        ) : null}

        {/* Tabs */}
        <View style={styles.segment}>
          <Pressable
            onPress={() => setTab('friends')}
            style={[styles.segmentBtn, tab === 'friends' && styles.segmentBtnOn]}>
            <Text style={[styles.segmentText, tab === 'friends' && styles.segmentTextOn]}>
              Friends ({friends.length})
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setTab('requests')}
            style={[styles.segmentBtn, tab === 'requests' && styles.segmentBtnOn]}>
            <Text style={[styles.segmentText, tab === 'requests' && styles.segmentTextOn]}>
              Requests ({incoming.length})
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setTab('streaks')}
            style={[styles.segmentBtn, tab === 'streaks' && styles.segmentBtnOn]}>
            <Text style={[styles.segmentText, tab === 'streaks' && styles.segmentTextOn]}>
              Streaks ({streaks.filter((s) => s.status === 'active').length})
            </Text>
          </Pressable>
        </View>

        {tab === 'friends' ? (
          friends.length === 0 ? (
            <Text style={styles.hint}>No friends yet. Search a username above to add someone.</Text>
          ) : (
            <View style={styles.block}>
              {friends.map((u) => (
                <View key={u.user_id} style={styles.row}>
                  <Avatar palette={palette} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName}>@{u.username}</Text>
                    {u.display_name ? <Text style={styles.rowMeta}>{u.display_name}</Text> : null}
                  </View>
                  <Pressable onPress={() => removeFriendFlow(u)} hitSlop={6}>
                    <Text style={styles.linkMuted}>Remove</Text>
                  </Pressable>
                  <Pressable onPress={() => blockFlow(u)} hitSlop={6}>
                    <Text style={styles.linkDanger}>Block</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )
        ) : tab === 'requests' ? (
          <View style={styles.block}>
            {incoming.length === 0 && outgoing.length === 0 ? (
              <Text style={styles.hint}>No pending requests.</Text>
            ) : null}

            {incoming.length > 0 ? <Text style={styles.subLabel}>Incoming</Text> : null}
            {incoming.map((r) => (
              <View key={r.id} style={styles.reqRow}>
                <View style={styles.reqTop}>
                  <Avatar palette={palette} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName}>@{r.user.username}</Text>
                    {r.message ? <Text style={styles.rowMeta}>“{r.message}”</Text> : null}
                  </View>
                </View>
                <View style={styles.reqActions}>
                  <AppButton
                    label="Accept"
                    icon="checkmark"
                    onPress={() => guard(() => respondFriendRequest(r.id, 'accept'), 'Could not accept')}
                    style={styles.reqBtn}
                  />
                  <AppButton
                    label="Decline"
                    variant="secondary"
                    onPress={() => guard(() => respondFriendRequest(r.id, 'decline'), 'Could not decline')}
                    style={styles.reqBtn}
                  />
                  <Pressable onPress={() => blockFlow(r.user)} hitSlop={6} style={styles.reqBlock}>
                    <Text style={styles.linkDanger}>Block</Text>
                  </Pressable>
                </View>
              </View>
            ))}

            {outgoing.length > 0 ? <Text style={styles.subLabel}>Sent</Text> : null}
            {outgoing.map((r) => (
              <View key={r.id} style={styles.row}>
                <Avatar palette={palette} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName}>@{r.user.username}</Text>
                  <Text style={styles.rowMeta}>Pending</Text>
                </View>
                <Pressable onPress={() => guard(() => cancelFriendRequest(r.id), 'Could not cancel')} hitSlop={6}>
                  <Text style={styles.linkMuted}>Cancel</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.block}>
            <AppButton
              label="New streak"
              icon="add"
              onPress={() => router.push('/streak/new')}
              style={{ marginBottom: Spacing.one }}
            />
            {streaks.length === 0 ? (
              <Text style={styles.hint}>
                No streaks yet. Start one with a friend to keep each other training.
              </Text>
            ) : null}
            {streaks.map((s) => (
              <StreakCard
                key={s.id}
                streak={s}
                onAccept={() => guard(() => respondStreakInvite(s.id, true), 'Could not accept')}
                onDecline={() => guard(() => respondStreakInvite(s.id, false), 'Could not decline')}
                onLeave={() => leaveStreakFlow(s)}
                onOpen={() => router.push(`/streak/${s.id}`)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function StreakCard({
  streak: s,
  onAccept,
  onDecline,
  onLeave,
  onOpen,
}: {
  streak: Streak;
  onAccept: () => void;
  onDecline: () => void;
  onLeave: () => void;
  onOpen: () => void;
}) {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const missText = s.on_miss === 'reset' ? 'resets to 0' : 'pauses';
  const friend = s.friend.profile.username;

  return (
    <View style={styles.streakCard}>
      <View style={styles.streakHead}>
        <Ionicons name="flame" size={20} color={palette.accent} />
        <Text style={styles.streakName} numberOfLines={1}>
          {s.name}
        </Text>
        <View style={styles.statusPill}>
          <Text style={styles.statusText}>
            {s.status === 'active' ? 'Active' : s.invitedPending ? 'Invite' : 'Pending'}
          </Text>
        </View>
      </View>
      <Text style={styles.streakWith}>with @{friend}</Text>
      <Text style={styles.streakTargets}>
        You {s.me.target}/wk · @{friend} {s.friend.target}/wk · miss → {missText}
      </Text>
      {s.invitedPending ? (
        <>
          <Text style={styles.rulesNote}>
            A workout counts when you complete a session in Gainz (self-reported). 7-day cycles.
          </Text>
          <View style={styles.streakActions}>
            <AppButton label="Accept" icon="checkmark" onPress={onAccept} style={{ flex: 1 }} />
            <AppButton label="Decline" variant="secondary" onPress={onDecline} style={{ flex: 1 }} />
          </View>
        </>
      ) : s.waitingOnFriend ? (
        <View style={styles.streakFooter}>
          <Text style={styles.waiting}>Waiting for @{friend} to accept</Text>
          <Pressable onPress={onLeave} hitSlop={6}>
            <Text style={styles.linkMuted}>Cancel</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {s.progress ? (
            <>
              <View style={styles.banner}>
                <Ionicons name="flame" size={16} color={palette.accent} />
                <Text style={styles.bannerText}>
                  {s.progress.consecutive > 0
                    ? `${s.progress.consecutive}-cycle streak`
                    : `Cycle ${s.progress.cycleIndex + 1}`}
                </Text>
                <Text style={styles.bannerSub}>
                  {s.progress.bothMetThisCycle
                    ? 'On track ✓'
                    : `ends ${formatDate(s.progress.cycleEnd)}`}
                </Text>
              </View>
              <ProgressBar
                label="You"
                count={s.progress.me.count}
                target={s.progress.me.target}
                palette={palette}
              />
              <ProgressBar
                label={`@${friend}`}
                count={s.progress.friend.count}
                target={s.progress.friend.target}
                palette={palette}
              />
            </>
          ) : null}
          <View style={styles.streakFooter}>
            <Pressable onPress={onOpen} hitSlop={6}>
              <Text style={styles.linkAccent}>View details ›</Text>
            </Pressable>
            <Pressable onPress={onLeave} hitSlop={6}>
              <Text style={styles.linkDanger}>Leave</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

function ProgressBar({
  label,
  count,
  target,
  palette,
}: {
  label: string;
  count: number;
  target: number;
  palette: Palette;
}) {
  const styles = useThemedStyles(makeStyles);
  const pct = target > 0 ? Math.min(1, count / target) : 0;
  const met = count >= target;
  return (
    <View style={styles.pbRow}>
      <Text style={styles.pbLabel} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.pbTrack}>
        <View
          style={[
            styles.pbFill,
            { width: `${pct * 100}%`, backgroundColor: met ? palette.accent : palette.accent2 },
          ]}
        />
      </View>
      <Text style={styles.pbCount}>
        {count}/{target}
      </Text>
    </View>
  );
}

function Avatar({ palette }: { palette: Palette }) {
  return (
    <View
      style={{
        width: 36,
        height: 36,
        borderRadius: Radius.full,
        backgroundColor: palette.surface2,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Ionicons name="person" size={18} color={palette.muted} />
    </View>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: palette.bg },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.four,
      paddingVertical: Spacing.three,
      borderBottomColor: palette.border,
      borderBottomWidth: 1,
    },
    side: { minWidth: 40 },
    topTitle: { color: palette.fg, fontSize: 17, fontWeight: '700' },
    content: { padding: Spacing.four, paddingBottom: Spacing.eight },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    logo: {
      width: 60,
      height: 60,
      borderRadius: Radius.full,
      backgroundColor: palette.surface,
      borderColor: palette.border,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      marginTop: Spacing.four,
    },
    headline: { color: palette.fg, fontSize: 24, fontWeight: '800', textAlign: 'center', marginTop: Spacing.three },
    sub: {
      color: palette.muted,
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 20,
      marginTop: Spacing.two,
      marginBottom: Spacing.three,
    },
    handleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: palette.surface,
      borderColor: palette.border,
      borderWidth: 1,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.three,
      marginTop: Spacing.three,
    },
    at: { color: palette.muted, fontSize: 18, fontWeight: '700' },
    handleInput: {
      flex: 1,
      color: palette.fg,
      fontSize: 18,
      fontWeight: '600',
      paddingVertical: Spacing.three,
      paddingLeft: Spacing.one,
    },
    error: { color: palette.danger, fontSize: 14, marginTop: Spacing.three, lineHeight: 19 },

    youAre: { color: palette.muted, fontSize: 14, marginBottom: Spacing.three },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.two,
      paddingHorizontal: Spacing.three,
      backgroundColor: palette.surface,
      borderColor: palette.border,
      borderWidth: 1,
      borderRadius: Radius.md,
    },
    search: { flex: 1, color: palette.fg, fontSize: 16, paddingVertical: Spacing.three },
    hint: { color: palette.muted, fontSize: 14, marginTop: Spacing.three, lineHeight: 20 },
    block: { marginTop: Spacing.three, gap: Spacing.two },
    subLabel: { color: palette.muted, fontSize: 12, fontWeight: '700', marginTop: Spacing.two },

    segment: {
      flexDirection: 'row',
      backgroundColor: palette.surface,
      borderColor: palette.border,
      borderWidth: 1,
      borderRadius: Radius.md,
      padding: 3,
      gap: 3,
      marginTop: Spacing.five,
    },
    segmentBtn: { flex: 1, alignItems: 'center', paddingVertical: Spacing.two + 2, borderRadius: Radius.sm },
    segmentBtnOn: { backgroundColor: palette.accent },
    segmentText: { color: palette.muted, fontSize: 14, fontWeight: '700' },
    segmentTextOn: { color: palette.onAccent },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.three,
      backgroundColor: palette.surface,
      borderColor: palette.border,
      borderWidth: 1,
      borderRadius: Radius.md,
      padding: Spacing.three,
    },
    rowName: { color: palette.fg, fontSize: 15, fontWeight: '700' },
    rowMeta: { color: palette.muted, fontSize: 13, marginTop: 1 },
    tag: { color: palette.muted, fontSize: 13, fontWeight: '700' },
    linkMuted: { color: palette.muted, fontSize: 14, fontWeight: '700' },
    linkDanger: { color: palette.danger, fontSize: 14, fontWeight: '700' },
    linkAccent: { color: palette.accent, fontSize: 14, fontWeight: '700' },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.one,
      backgroundColor: palette.accent,
      borderRadius: Radius.full,
      paddingVertical: Spacing.two,
      paddingHorizontal: Spacing.three,
    },
    addBtnText: { color: palette.onAccent, fontSize: 14, fontWeight: '800' },

    reqRow: {
      backgroundColor: palette.surface,
      borderColor: palette.border,
      borderWidth: 1,
      borderRadius: Radius.md,
      padding: Spacing.three,
      gap: Spacing.three,
    },
    reqTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
    reqActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
    reqBtn: { flex: 1 },
    reqBlock: { paddingHorizontal: Spacing.two },

    streakCard: {
      backgroundColor: palette.surface,
      borderColor: palette.border,
      borderWidth: 1,
      borderRadius: Radius.md,
      padding: Spacing.four,
      gap: Spacing.one,
    },
    streakHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
    streakName: { flex: 1, color: palette.fg, fontSize: 16, fontWeight: '800' },
    statusPill: {
      backgroundColor: palette.surface2,
      borderRadius: Radius.full,
      paddingHorizontal: Spacing.two,
      paddingVertical: 2,
    },
    statusText: { color: palette.muted, fontSize: 11, fontWeight: '700' },
    streakWith: { color: palette.muted, fontSize: 13 },
    streakTargets: { color: palette.fg, fontSize: 13, marginTop: Spacing.one },
    streakMeta: { color: palette.muted, fontSize: 12, marginTop: Spacing.one },
    rulesNote: { color: palette.muted, fontSize: 12, lineHeight: 18, marginTop: Spacing.two },
    streakActions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.three },
    streakFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: Spacing.three,
    },
    waiting: { color: palette.muted, fontSize: 13, flex: 1 },

    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.two,
      backgroundColor: palette.surface2,
      borderRadius: Radius.sm,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two,
      marginTop: Spacing.three,
    },
    bannerText: { flex: 1, color: palette.fg, fontSize: 13, fontWeight: '800' },
    bannerSub: { color: palette.muted, fontSize: 12, fontWeight: '700' },
    pbRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: Spacing.two },
    pbLabel: { color: palette.muted, fontSize: 12, width: 64 },
    pbTrack: {
      flex: 1,
      height: 8,
      borderRadius: Radius.full,
      backgroundColor: palette.surface2,
      overflow: 'hidden',
    },
    pbFill: { height: '100%', borderRadius: Radius.full },
    pbCount: { color: palette.fg, fontSize: 12, fontWeight: '700', width: 40, textAlign: 'right' },
  });
