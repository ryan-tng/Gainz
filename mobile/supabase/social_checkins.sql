-- ============================================================================
-- Gainz Social — Part 3: streak check-ins
-- Run AFTER social_streaks.sql.
--
-- Check-ins are an append-only, SELF-REPORTED credit log, kept SEPARATE from
-- the (editable, local) workout history — so deleting a workout never silently
-- changes streak credit. This does not prove a workout happened.
--
-- Each row is an event: delta = +1 (credit) or -1 (correction/void, Phase 5).
-- A member's count for a cycle = greatest(sum(delta), 0).
-- ============================================================================

create table if not exists public.streak_checkins (
  id uuid primary key default gen_random_uuid(),
  streak_id uuid not null references public.streaks (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  cycle_index int not null,
  delta int not null default 1 check (delta in (1, -1)),
  source text not null default 'app' check (source in ('app', 'manual')),
  note text,
  created_at timestamptz not null default now()
);
create index if not exists streak_checkins_lookup
  on public.streak_checkins (streak_id, user_id, cycle_index);
alter table public.streak_checkins enable row level security;

-- Members can read every check-in on their streaks (to see each other's progress).
create policy "read member checkins" on public.streak_checkins for select to authenticated
  using (public.is_streak_member(streak_id, auth.uid()));

-- Append a self-reported credit for the current cycle of an active streak.
create or replace function public.check_in(p_streak uuid)
returns int language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); s public.streaks; idx int;
begin
  if uid is null then raise exception 'Not signed in.'; end if;
  select * into s from public.streaks where id = p_streak;
  if not found then raise exception 'Streak not found.'; end if;
  if not public.is_streak_member(p_streak, uid) then raise exception 'Not a member of this streak.'; end if;
  if s.status <> 'active' or s.started_at is null then return null; end if;

  idx := floor(extract(epoch from (now() - s.started_at)) / (s.period_days * 86400))::int;
  insert into public.streak_checkins (streak_id, user_id, cycle_index, delta, source)
    values (p_streak, uid, idx, 1, 'app');
  return idx;
end;
$$;

revoke all on function public.check_in(uuid) from public, anon;
grant execute on function public.check_in(uuid) to authenticated;
