-- ============================================================================
-- Gainz Social — Part 6: view-once streak photos
-- Run AFTER social_photos.sql.
--
-- A friend's proof photo can be opened once (Snapchat-style). Opening records
-- a view; storage then allows loading the image for 2 minutes after that first
-- open, so the app has time to load it and it can't be reopened afterwards.
-- The photo's owner can always view their own photo.
-- ============================================================================

create table if not exists public.photo_views (
  checkin_id uuid not null references public.streak_checkins (id) on delete cascade,
  viewer uuid not null references auth.users (id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (checkin_id, viewer)
);
alter table public.photo_views enable row level security;

-- Members can see who opened photos on their streaks (for "Opened" receipts).
drop policy if exists "read views on member checkins" on public.photo_views;
create policy "read views on member checkins" on public.photo_views for select to authenticated
  using (exists (
    select 1 from public.streak_checkins c
    where c.id = checkin_id and public.is_streak_member(c.streak_id, auth.uid())
  ));

-- Open a photo: records the first view and returns the storage path. A second
-- open after the 2-minute load window is refused.
create or replace function public.open_streak_photo(p_checkin uuid)
returns text language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); c public.streak_checkins; seen timestamptz;
begin
  if uid is null then raise exception 'Not signed in.'; end if;
  select * into c from public.streak_checkins where id = p_checkin;
  if not found or c.photo_path is null or not public.is_streak_member(c.streak_id, uid) then
    raise exception 'Photo not found.';
  end if;
  if c.created_at < now() - interval '7 days' then raise exception 'This photo has expired.'; end if;
  if c.user_id = uid then return c.photo_path; end if;           -- your own photo
  if public.is_blocked(c.user_id, uid) then raise exception 'Photo not found.'; end if;

  select viewed_at into seen from public.photo_views where checkin_id = p_checkin and viewer = uid;
  if found and seen < now() - interval '2 minutes' then
    raise exception 'You already opened this photo.';
  end if;
  insert into public.photo_views (checkin_id, viewer) values (p_checkin, uid)
    on conflict (checkin_id, viewer) do nothing;
  return c.photo_path;
end;
$$;

-- Storage read check: the owner, or a streak member within 2 minutes of their
-- first open of that photo.
create or replace function public.can_open_streak_photo(p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select split_part(p_name, '/', 1) = auth.uid()::text
      or (
        public.can_view_streak_photo(p_name)
        and exists (
          select 1
          from public.streak_checkins c
          join public.photo_views v on v.checkin_id = c.id and v.viewer = auth.uid()
          where c.photo_path = p_name
            and v.viewed_at > now() - interval '2 minutes'
        )
      );
$$;

drop policy if exists "streak photos read members" on storage.objects;
create policy "streak photos read members" on storage.objects for select to authenticated
  using (
    bucket_id = 'streak-photos'
    and created_at > now() - interval '7 days'
    and public.can_open_streak_photo(name)
  );

revoke all on function public.open_streak_photo(uuid), public.can_open_streak_photo(text) from public, anon;
grant execute on function public.open_streak_photo(uuid), public.can_open_streak_photo(text) to authenticated;
