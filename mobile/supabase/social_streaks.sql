-- ============================================================================
-- Gainz Social — Part 2: streaks (creation + consent)
-- Run AFTER social.sql. Adds the streak tables, membership RLS, and the
-- create/accept/leave functions. Progress + check-ins come in Phase 4.
-- ============================================================================

create table if not exists public.streaks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  creator uuid not null references auth.users (id) on delete cascade,
  period_days int not null default 7,
  started_at timestamptz,                 -- null until BOTH accept
  status text not null default 'pending'
    check (status in ('pending', 'active', 'ended')),
  on_miss text not null default 'reset'
    check (on_miss in ('reset', 'pause')),
  created_at timestamptz not null default now()
);
alter table public.streaks enable row level security;

create table if not exists public.streak_members (
  streak_id uuid not null references public.streaks (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  target int not null check (target between 1 and 14),   -- workouts per cycle
  share_labels boolean not null default false,            -- opt-in exercise labels
  accepted boolean not null default false,
  left_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (streak_id, user_id)
);
alter table public.streak_members enable row level security;

-- Membership predicate (SECURITY DEFINER bypasses RLS, so no recursion).
create or replace function public.is_streak_member(p_streak uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.streak_members m
    where m.streak_id = p_streak and m.user_id = p_user
  );
$$;

-- Reads: members can see their streaks and all member rows on those streaks.
create policy "read member streaks" on public.streaks for select to authenticated
  using (public.is_streak_member(id, auth.uid()));
create policy "read member rows" on public.streak_members for select to authenticated
  using (public.is_streak_member(streak_id, auth.uid()));

-- ---------------------------------------------------------------------------
-- Actions
-- ---------------------------------------------------------------------------

create or replace function public.create_streak(
  p_name text,
  p_friend uuid,
  p_my_target int,
  p_friend_target int,
  p_on_miss text default 'reset'
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
  if p_on_miss not in ('reset', 'pause') then raise exception 'Invalid miss rule.'; end if;

  insert into public.streaks (name, creator, on_miss)
    values (left(trim(p_name), 60), uid, p_on_miss) returning id into sid;
  -- Creator auto-accepts (they set the rules); friend must accept.
  insert into public.streak_members (streak_id, user_id, target, accepted)
    values (sid, uid, p_my_target, true);
  insert into public.streak_members (streak_id, user_id, target, accepted)
    values (sid, p_friend, p_friend_target, false);
  return sid;
end;
$$;

create or replace function public.respond_streak_invite(p_streak uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); mem public.streak_members; everyone boolean;
begin
  if uid is null then raise exception 'Not signed in.'; end if;
  select * into mem from public.streak_members where streak_id = p_streak and user_id = uid;
  if not found then raise exception 'You''re not part of this streak.'; end if;
  if mem.accepted then raise exception 'You already accepted this streak.'; end if;

  if p_accept then
    update public.streak_members set accepted = true where streak_id = p_streak and user_id = uid;
    select bool_and(accepted) into everyone from public.streak_members where streak_id = p_streak;
    if everyone then
      update public.streaks set status = 'active', started_at = now()
        where id = p_streak and status = 'pending';
    end if;
  else
    update public.streaks set status = 'ended' where id = p_streak and status = 'pending';
  end if;
end;
$$;

create or replace function public.leave_streak(p_streak uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not signed in.'; end if;
  if not public.is_streak_member(p_streak, uid) then raise exception 'Not your streak.'; end if;
  update public.streak_members set left_at = now() where streak_id = p_streak and user_id = uid;
  update public.streaks set status = 'ended' where id = p_streak and status in ('pending', 'active');
end;
$$;

-- ---------------------------------------------------------------------------
-- End shared streaks when a friendship ends (completes the Phase 0 TODO).
-- ---------------------------------------------------------------------------

create or replace function public.remove_friend(p_other uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not signed in.'; end if;
  delete from public.friendships
    where user_lo = least(uid, p_other) and user_hi = greatest(uid, p_other);
  update public.streaks s set status = 'ended'
    where s.status in ('pending', 'active')
      and exists (select 1 from public.streak_members m where m.streak_id = s.id and m.user_id = uid)
      and exists (select 1 from public.streak_members m where m.streak_id = s.id and m.user_id = p_other);
end;
$$;

create or replace function public.block_user(p_other uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not signed in.'; end if;
  if p_other = uid then raise exception 'You can''t block yourself.'; end if;
  insert into public.blocks (blocker, blocked) values (uid, p_other) on conflict do nothing;
  delete from public.friendships
    where user_lo = least(uid, p_other) and user_hi = greatest(uid, p_other);
  update public.friend_requests set status = 'cancelled', responded_at = now()
    where status = 'pending'
      and ((from_user = uid and to_user = p_other) or (from_user = p_other and to_user = uid));
  update public.streaks s set status = 'ended'
    where s.status in ('pending', 'active')
      and exists (select 1 from public.streak_members m where m.streak_id = s.id and m.user_id = uid)
      and exists (select 1 from public.streak_members m where m.streak_id = s.id and m.user_id = p_other);
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke all on function
  public.create_streak(text, uuid, int, int, text),
  public.respond_streak_invite(uuid, boolean),
  public.leave_streak(uuid)
  from public, anon;

grant execute on function
  public.create_streak(text, uuid, int, int, text),
  public.respond_streak_invite(uuid, boolean),
  public.leave_streak(uuid),
  public.remove_friend(uuid),
  public.block_user(uuid)
  to authenticated;
