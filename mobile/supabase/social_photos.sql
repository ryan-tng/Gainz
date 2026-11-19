-- ============================================================================
-- Gainz Social — Part 5: photo streaks, auto-ending lost streaks, no Leave
-- Run AFTER social_corrections.sql (and security_hardening.sql).
--
-- What this adds:
--   * Streaks end on their own when a week is missed ("Lost at N"). There is no
--     Leave for active streaks; skipping someone after workouts is how a streak
--     dies. Pending invites can still be cancelled/declined.
--   * New streaks are always "reset" (the pause option is retired; old pause
--     streaks keep working and never auto-end).
--   * Optional photo proof per streak: check-ins on a photo streak must carry
--     a photo taken in the app, stored in a PRIVATE bucket that only the two
--     members can read, visible for 7 days.
--   * Skips (undo a check-in right after a workout), reactions, photo reports.
--
-- Check-ins stay SELF-REPORTED. Photos raise the bar; they don't prove anything.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
alter table public.streaks add column if not exists photo_required boolean not null default false;
alter table public.streaks add column if not exists ended_reason text;      -- lost | cancelled | null (friend removed, declined, legacy)
alter table public.streaks add column if not exists ended_at timestamptz;
alter table public.streaks add column if not exists lost_at_count int;      -- weeks in a row before the miss

alter table public.streak_checkins add column if not exists photo_path text;
alter table public.streak_checkins drop constraint if exists streak_checkins_source_check;
alter table public.streak_checkins add constraint streak_checkins_source_check
  check (source in ('app', 'manual', 'photo', 'skip'));

-- Turns invalid text into null instead of raising (used by storage policies).
create or replace function public.try_uuid(p text)
returns uuid language plpgsql immutable as $$
begin
  return p::uuid;
exception when others then
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Auto-end: a "reset" streak ends as soon as a finished week had someone under
-- target. Settled lazily (whenever a member lists streaks or checks in), so no
-- scheduler is needed. The streak's count is derived, so this only records the
-- outcome; nothing is lost if it runs late.
-- ---------------------------------------------------------------------------
create or replace function public.settle_streak(p_streak uuid)
returns void language plpgsql security definer set search_path = public as $$
declare s public.streaks; cur int; i int; passed int := 0; ok boolean;
begin
  select * into s from public.streaks where id = p_streak for update;
  if not found or s.status <> 'active' or s.started_at is null or s.on_miss <> 'reset' then
    return;
  end if;
  cur := floor(extract(epoch from (now() - s.started_at)) / (s.period_days * 86400))::int;
  for i in 0 .. cur - 1 loop
    select bool_and(coalesce(c.n, 0) >= m.target) into ok
      from public.streak_members m
      left join lateral (
        select greatest(sum(k.delta), 0) as n
        from public.streak_checkins k
        where k.streak_id = p_streak and k.user_id = m.user_id and k.cycle_index = i
      ) c on true
      where m.streak_id = p_streak;
    if not coalesce(ok, false) then
      update public.streaks
        set status = 'ended',
            ended_reason = 'lost',
            ended_at = s.started_at + make_interval(days => (i + 1) * s.period_days),
            lost_at_count = passed
        where id = p_streak;
      return;
    end if;
    passed := passed + 1;
  end loop;
end;
$$;

create or replace function public.settle_my_streaks()
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); r record;
begin
  if uid is null then return; end if;
  for r in
    select s.id from public.streaks s
    join public.streak_members m on m.streak_id = s.id and m.user_id = uid
    where s.status = 'active'
  loop
    perform public.settle_streak(r.id);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Create: always reset; optional photo proof. Replaces the 5-arg version.
-- ---------------------------------------------------------------------------
drop function if exists public.create_streak(text, uuid, int, int, text);
create or replace function public.create_streak(
  p_name text,
  p_friend uuid,
  p_my_target int,
  p_friend_target int,
  p_photo boolean default false
) returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); sid uuid;
begin
  if uid is null then raise exception 'Not signed in.'; end if;
  if p_friend = uid then raise exception 'Pick a friend to streak with.'; end if;
  if not public.are_friends(uid, p_friend) then
    raise exception 'You can only start a streak with a friend.';
  end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Give your streak a name.'; end if;
  if p_my_target < 1 or p_my_target > 14 or p_friend_target < 1 or p_friend_target > 14 then
    raise exception 'Targets must be between 1 and 14 per week.';
  end if;

  insert into public.streaks (name, creator, on_miss, photo_required)
    values (left(trim(p_name), 60), uid, 'reset', coalesce(p_photo, false)) returning id into sid;
  insert into public.streak_members (streak_id, user_id, target, accepted)
    values (sid, uid, p_my_target, true);
  insert into public.streak_members (streak_id, user_id, target, accepted)
    values (sid, p_friend, p_friend_target, false);
  return sid;
end;
$$;

-- ---------------------------------------------------------------------------
-- No leaving active streaks. This now only cancels a PENDING invite (the
-- creator cancelling, or the invitee declining via respond_streak_invite).
-- ---------------------------------------------------------------------------
create or replace function public.leave_streak(p_streak uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not signed in.'; end if;
  if not public.is_streak_member(p_streak, uid) then raise exception 'Not your streak.'; end if;
  update public.streaks set status = 'ended', ended_reason = 'cancelled', ended_at = now()
    where id = p_streak and status = 'pending';
  if not found then
    raise exception 'Active streaks can''t be left. Skip it after your workouts and it ends on its own.';
  end if;
  update public.streak_members set left_at = now() where streak_id = p_streak and user_id = uid;
end;
$$;

-- ---------------------------------------------------------------------------
-- Check-ins
-- ---------------------------------------------------------------------------

-- Plain check-in (non-photo streaks). Settles first so a lost streak can't be
-- revived by a late check-in.
drop function if exists public.check_in(uuid, text);
create or replace function public.check_in(p_streak uuid, p_label text default null)
returns int language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); s public.streaks; idx int; shares boolean;
begin
  if uid is null then raise exception 'Not signed in.'; end if;
  if not public.is_streak_member(p_streak, uid) then raise exception 'Not a member of this streak.'; end if;
  perform public.settle_streak(p_streak);
  select * into s from public.streaks where id = p_streak;
  if not found then raise exception 'Streak not found.'; end if;
  if s.status <> 'active' or s.started_at is null then return null; end if;
  if s.photo_required then raise exception 'This streak needs a photo.'; end if;

  select share_labels into shares from public.streak_members where streak_id = p_streak and user_id = uid;
  idx := floor(extract(epoch from (now() - s.started_at)) / (s.period_days * 86400))::int;
  insert into public.streak_checkins (streak_id, user_id, cycle_index, delta, source, label)
    values (p_streak, uid, idx, 1, 'app', case when shares then left(p_label, 60) else null end);
  return idx;
end;
$$;

-- Photo check-in. The photo must already be uploaded to the caller's own folder
-- for this streak: streak-photos/<user_id>/<streak_id>/<file>.
create or replace function public.check_in_photo(p_streak uuid, p_label text, p_photo_path text)
returns int language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); s public.streaks; idx int; shares boolean;
begin
  if uid is null then raise exception 'Not signed in.'; end if;
  if not public.is_streak_member(p_streak, uid) then raise exception 'Not a member of this streak.'; end if;
  if p_photo_path is null
     or p_photo_path not like uid::text || '/' || p_streak::text || '/%'
     or position('..' in p_photo_path) > 0 then
    raise exception 'Invalid photo.';
  end if;
  if not exists (
    select 1 from storage.objects o where o.bucket_id = 'streak-photos' and o.name = p_photo_path
  ) then
    raise exception 'Photo upload not found. Try again.';
  end if;

  perform public.settle_streak(p_streak);
  select * into s from public.streaks where id = p_streak;
  if not found then raise exception 'Streak not found.'; end if;
  if s.status <> 'active' or s.started_at is null then return null; end if;

  select share_labels into shares from public.streak_members where streak_id = p_streak and user_id = uid;
  idx := floor(extract(epoch from (now() - s.started_at)) / (s.period_days * 86400))::int;
  insert into public.streak_checkins (streak_id, user_id, cycle_index, delta, source, label, photo_path)
    values (p_streak, uid, idx, 1, 'photo',
            case when shares then left(p_label, 60) else null end, p_photo_path);
  return idx;
end;
$$;

-- Skip: undo this workout's credit for one streak (from the post-workout Edit).
-- Append-only like everything else; shows as "skipped" in the activity log.
create or replace function public.skip_checkin(p_streak uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); s public.streaks; idx int; cur int;
begin
  if uid is null then raise exception 'Not signed in.'; end if;
  if not public.is_streak_member(p_streak, uid) then raise exception 'Not a member of this streak.'; end if;
  select * into s from public.streaks where id = p_streak;
  if not found or s.status <> 'active' or s.started_at is null then return; end if;
  idx := floor(extract(epoch from (now() - s.started_at)) / (s.period_days * 86400))::int;
  select coalesce(sum(delta), 0) into cur
    from public.streak_checkins where streak_id = p_streak and user_id = uid and cycle_index = idx;
  if cur <= 0 then return; end if;
  insert into public.streak_checkins (streak_id, user_id, cycle_index, delta, source)
    values (p_streak, uid, idx, -1, 'skip');
end;
$$;

-- ---------------------------------------------------------------------------
-- Reactions (fire / muscle) on a friend's check-in.
-- ---------------------------------------------------------------------------
create table if not exists public.streak_reactions (
  checkin_id uuid not null references public.streak_checkins (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  emoji text not null check (emoji in ('fire', 'muscle')),
  created_at timestamptz not null default now(),
  primary key (checkin_id, user_id)
);
alter table public.streak_reactions enable row level security;

drop policy if exists "read reactions on member checkins" on public.streak_reactions;
create policy "read reactions on member checkins" on public.streak_reactions for select to authenticated
  using (exists (
    select 1 from public.streak_checkins c
    where c.id = checkin_id and public.is_streak_member(c.streak_id, auth.uid())
  ));

-- Set, change, or clear (p_emoji null) your reaction on a friend's check-in.
create or replace function public.react_checkin(p_checkin uuid, p_emoji text)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); c public.streak_checkins;
begin
  if uid is null then raise exception 'Not signed in.'; end if;
  select * into c from public.streak_checkins where id = p_checkin;
  if not found or not public.is_streak_member(c.streak_id, uid) then raise exception 'Not found.'; end if;
  if c.user_id = uid then raise exception 'You can''t react to your own check-in.'; end if;
  if p_emoji is null then
    delete from public.streak_reactions where checkin_id = p_checkin and user_id = uid;
  else
    if p_emoji not in ('fire', 'muscle') then raise exception 'Invalid reaction.'; end if;
    insert into public.streak_reactions (checkin_id, user_id, emoji) values (p_checkin, uid, p_emoji)
      on conflict (checkin_id, user_id) do update set emoji = excluded.emoji, created_at = now();
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Photo reports (App Store guideline 1.2: users can report shared content).
-- No client read access; review them in the Supabase dashboard.
-- ---------------------------------------------------------------------------
create table if not exists public.photo_reports (
  id uuid primary key default gen_random_uuid(),
  checkin_id uuid references public.streak_checkins (id) on delete set null,
  photo_path text,
  reporter uuid references auth.users (id) on delete set null,
  reported_user uuid,
  reason text,
  created_at timestamptz not null default now()
);
alter table public.photo_reports enable row level security;

create or replace function public.report_photo(p_checkin uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); c public.streak_checkins;
begin
  if uid is null then raise exception 'Not signed in.'; end if;
  select * into c from public.streak_checkins where id = p_checkin;
  if not found or not public.is_streak_member(c.streak_id, uid) then raise exception 'Not found.'; end if;
  if not public.increment_ai_usage('photo_report', 20) then
    raise exception 'Too many reports today. Try again tomorrow.';
  end if;
  insert into public.photo_reports (checkin_id, photo_path, reporter, reported_user, reason)
    values (p_checkin, c.photo_path, uid, c.user_id, left(p_reason, 300));
end;
$$;

-- ---------------------------------------------------------------------------
-- Storage: private bucket. Path = <owner user_id>/<streak_id>/<file>.jpg
--   upload: only into your own folder, only for a streak you're in
--   read:   members of that streak, not blocked by the owner, for 7 days
--   delete: the owner
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('streak-photos', 'streak-photos', false, 5242880, array['image/jpeg', 'image/png'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.can_view_streak_photo(p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_streak_member(public.try_uuid(split_part(p_name, '/', 2)), auth.uid())
     and not public.is_blocked(public.try_uuid(split_part(p_name, '/', 1)), auth.uid());
$$;

drop policy if exists "streak photos upload own" on storage.objects;
create policy "streak photos upload own" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'streak-photos'
    and split_part(name, '/', 1) = auth.uid()::text
    and public.is_streak_member(public.try_uuid(split_part(name, '/', 2)), auth.uid())
  );

drop policy if exists "streak photos read members" on storage.objects;
create policy "streak photos read members" on storage.objects for select to authenticated
  using (
    bucket_id = 'streak-photos'
    and created_at > now() - interval '7 days'
    and public.can_view_streak_photo(name)
  );

drop policy if exists "streak photos delete own" on storage.objects;
create policy "streak photos delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'streak-photos' and split_part(name, '/', 1) = auth.uid()::text);

-- Server-only helper for the daily purge job and account deletion.
create or replace function public.streak_photo_paths(p_older_than_days int default null, p_user uuid default null)
returns setof text language sql stable security definer set search_path = public as $$
  select o.name from storage.objects o
  where o.bucket_id = 'streak-photos'
    and (p_older_than_days is null or o.created_at < now() - make_interval(days => p_older_than_days))
    and (p_user is null or split_part(o.name, '/', 1) = p_user::text)
  limit 1000;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke all on function
  public.settle_streak(uuid),
  public.settle_my_streaks(),
  public.create_streak(text, uuid, int, int, boolean),
  public.leave_streak(uuid),
  public.check_in(uuid, text),
  public.check_in_photo(uuid, text, text),
  public.skip_checkin(uuid),
  public.react_checkin(uuid, text),
  public.report_photo(uuid, text),
  public.can_view_streak_photo(text),
  public.streak_photo_paths(int, uuid)
  from public, anon;

grant execute on function
  public.settle_my_streaks(),
  public.create_streak(text, uuid, int, int, boolean),
  public.leave_streak(uuid),
  public.check_in(uuid, text),
  public.check_in_photo(uuid, text, text),
  public.skip_checkin(uuid),
  public.react_checkin(uuid, text),
  public.report_photo(uuid, text),
  public.can_view_streak_photo(text)
  to authenticated;

-- settle_streak is internal (called by the functions above); purge helper is server-only.
revoke all on function public.streak_photo_paths(int, uuid) from authenticated;
grant execute on function public.streak_photo_paths(int, uuid) to service_role;
