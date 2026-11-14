-- ============================================================================
-- Gainz Social — Part 4: corrections + label sharing
-- Run AFTER social_checkins.sql.
--
-- Corrections are append-only: a check-in is never edited or deleted. A
-- correction appends another event (+1 or -1) with a note, visible to both
-- people in the cycle's activity log. Exercise labels are opt-in per person.
-- ============================================================================

alter table public.streak_checkins add column if not exists label text;

-- Replace check_in to accept an optional label, stored only if the member has
-- opted into sharing labels (so we never store what they didn't choose to share).
drop function if exists public.check_in(uuid);
create or replace function public.check_in(p_streak uuid, p_label text default null)
returns int language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); s public.streaks; idx int; shares boolean;
begin
  if uid is null then raise exception 'Not signed in.'; end if;
  select * into s from public.streaks where id = p_streak;
  if not found then raise exception 'Streak not found.'; end if;
  if not public.is_streak_member(p_streak, uid) then raise exception 'Not a member of this streak.'; end if;
  if s.status <> 'active' or s.started_at is null then return null; end if;

  select share_labels into shares from public.streak_members where streak_id = p_streak and user_id = uid;
  idx := floor(extract(epoch from (now() - s.started_at)) / (s.period_days * 86400))::int;
  insert into public.streak_checkins (streak_id, user_id, cycle_index, delta, source, label)
    values (p_streak, uid, idx, 1, 'app', case when shares then left(p_label, 60) else null end);
  return idx;
end;
$$;

-- Append a manual correction (+1 or -1) with a note for the current cycle.
create or replace function public.correct_checkin(p_streak uuid, p_delta int, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); s public.streaks; idx int; cur int;
begin
  if uid is null then raise exception 'Not signed in.'; end if;
  if p_delta not in (1, -1) then raise exception 'Invalid correction.'; end if;
  select * into s from public.streaks where id = p_streak;
  if not found then raise exception 'Streak not found.'; end if;
  if not public.is_streak_member(p_streak, uid) then raise exception 'Not a member of this streak.'; end if;
  if s.status <> 'active' or s.started_at is null then raise exception 'This streak isn''t active.'; end if;

  idx := floor(extract(epoch from (now() - s.started_at)) / (s.period_days * 86400))::int;
  if p_delta = -1 then
    select coalesce(sum(delta), 0) into cur
      from public.streak_checkins where streak_id = p_streak and user_id = uid and cycle_index = idx;
    if cur <= 0 then raise exception 'Your count is already 0 this cycle.'; end if;
  end if;

  insert into public.streak_checkins (streak_id, user_id, cycle_index, delta, source, note)
    values (p_streak, uid, idx, p_delta, 'manual', left(p_note, 200));
end;
$$;

-- Toggle whether this member shares exercise labels with their friend.
create or replace function public.set_share_labels(p_streak uuid, p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not signed in.'; end if;
  update public.streak_members set share_labels = p_on
    where streak_id = p_streak and user_id = uid;
end;
$$;

revoke all on function
  public.check_in(uuid, text),
  public.correct_checkin(uuid, int, text),
  public.set_share_labels(uuid, boolean)
  from public, anon;
grant execute on function
  public.check_in(uuid, text),
  public.correct_checkin(uuid, int, text),
  public.set_share_labels(uuid, boolean)
  to authenticated;
