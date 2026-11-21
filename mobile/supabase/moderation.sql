-- ============================================================================
-- Gainz — moderation (App Store Guideline 1.2: user-generated content)
-- Run AFTER social.sql, social_streaks.sql and social_photos.sql.
--
--  * Blocked-word filter for usernames and friend-request messages (enforced
--    here in the database; the app mirrors the list for instant feedback in
--    src/lib/moderation.ts — keep them in sync).
--  * Report a user (usernames / friend-request messages), alongside the
--    existing photo reports.
--  * New reports trigger an email alert via a Supabase Database Webhook ->
--    POST https://gainz-api.vercel.app/api/report-alert (set up in the
--    dashboard; see app/api/report-alert/route.ts).
-- ============================================================================

-- Lowercase + undo common digit swaps (f4gg0t -> faggot) before matching.
create or replace function public.moderation_normalize(p text)
returns text language sql immutable set search_path = public as $$
  select translate(lower(coalesce(p, '')), '013457$8', 'oieastsb');
$$;

-- True if the text contains a slur / severe profanity. Substring match, so the
-- list avoids short words that hide inside normal ones (e.g. "pedometer").
create or replace function public.contains_blocked_word(p text)
returns boolean language sql immutable set search_path = public as $$
  select exists (
    select 1
    from unnest(array[
      'fuck','fuk','shit','cunt','nigger','nigga','niga','faggot','fagot','bitch','whore',
      'slut','rapist','nazi','hitler','kike','chink','retard','tranny','porn','pussy',
      'penis','vagina','dildo','jizz','twat','wanker','molest','pedophile','paedo','incest',
      'kkk','heil','killyourself','kys_'
    ]) as w
    where position(w in public.moderation_normalize(p)) > 0
  );
$$;

-- Handles that could impersonate the app or staff.
create or replace function public.is_reserved_username(p text)
returns boolean language sql immutable set search_path = public as $$
  select lower(coalesce(p, '')) = any (array[
    'gainz','gainzapp','gainz_app','gainzofficial','gainz_official','official',
    'admin','administrator','support','help','staff','moderator','mod','team',
    'security','system','root','null','undefined','me','you'
  ]);
$$;

create or replace function public.profiles_check_username()
returns trigger language plpgsql set search_path = public as $$
begin
  if public.contains_blocked_word(new.username::text) or public.is_reserved_username(new.username::text) then
    raise exception 'That username isn''t allowed. Try another.';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_check_username on public.profiles;
create trigger profiles_check_username
  before insert or update of username on public.profiles
  for each row execute function public.profiles_check_username();

create or replace function public.friend_requests_check_message()
returns trigger language plpgsql set search_path = public as $$
begin
  if public.contains_blocked_word(new.message) then
    raise exception 'Your message contains words that aren''t allowed.';
  end if;
  return new;
end;
$$;

drop trigger if exists friend_requests_check_message on public.friend_requests;
create trigger friend_requests_check_message
  before insert or update of message on public.friend_requests
  for each row execute function public.friend_requests_check_message();

-- Availability now also says "no" for blocked/reserved handles.
create or replace function public.username_available(p_username text)
returns boolean
language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := auth.uid(); q text := lower(trim(coalesce(p_username, '')));
begin
  if uid is null then raise exception 'Not signed in.'; end if;
  if q !~ '^[a-z0-9_]{3,20}$' then return false; end if;
  if public.contains_blocked_word(q) or public.is_reserved_username(q) then return false; end if;
  if not public.increment_ai_usage('username_check', 300) then
    raise exception 'Too many checks. Please slow down.';
  end if;
  return not exists (
    select 1 from public.profiles where username = q::citext and user_id <> uid
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- User reports
-- ---------------------------------------------------------------------------
create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid not null references auth.users (id) on delete cascade,
  reported_user uuid not null references auth.users (id) on delete cascade,
  reported_username text,
  reason text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
alter table public.user_reports enable row level security;
-- No select/insert policies: written only via report_user(), read by you in
-- the Supabase dashboard (service role).

-- Report someone you have a connection with (friend, any request, or a shared
-- streak) — the only places their username/message can reach you.
create or replace function public.report_user(p_user uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); uname text;
begin
  if uid is null then raise exception 'Not signed in.'; end if;
  if p_user is null or p_user = uid then raise exception 'Not found.'; end if;
  if not (
    public.are_friends(uid, p_user)
    or exists (
      select 1 from public.friend_requests
      where (from_user = uid and to_user = p_user) or (from_user = p_user and to_user = uid)
    )
    or exists (
      select 1 from public.streak_members a
      join public.streak_members b on b.streak_id = a.streak_id
      where a.user_id = uid and b.user_id = p_user
    )
  ) then
    raise exception 'Not found.';
  end if;
  if not public.increment_ai_usage('user_report', 20) then
    raise exception 'Too many reports today. Try again tomorrow.';
  end if;
  select username::text into uname from public.profiles where user_id = p_user;
  insert into public.user_reports (reporter, reported_user, reported_username, reason)
    values (uid, p_user, uname, left(p_reason, 500));
end;
$$;

revoke all on function
  public.username_available(text),
  public.report_user(uuid, text)
from public, anon;
grant execute on function
  public.username_available(text),
  public.report_user(uuid, text)
to authenticated;

-- Let photo reports be marked handled too.
alter table public.photo_reports add column if not exists resolved_at timestamptz;
