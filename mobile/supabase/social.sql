-- ============================================================================
-- Gainz Social — Part 1: profiles + friends
-- Run in the Supabase SQL editor (Dashboard → SQL → New query).
--
-- Adds cross-user relational data (RLS-protected) ALONGSIDE the existing
-- per-user private backup (user_backups). All mutations go through SECURITY
-- DEFINER functions so validation (blocks, duplicates, rate limits) is
-- centralized and can't be bypassed by a client writing rows directly.
--
-- Note: streak credit is self-reported — these rules stop a workout edit from
-- silently changing data, they do not prove a workout happened.
-- ============================================================================

create extension if not exists citext;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- A public handle per user. Contains NO sensitive data (no email, no workouts).
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username citext unique not null,
  display_name text,
  created_at timestamptz not null default now(),
  constraint username_format check (username ~ '^[a-z0-9_]{3,20}$')
);
alter table public.profiles enable row level security;

create table if not exists public.friendships (
  user_lo uuid not null references auth.users (id) on delete cascade,
  user_hi uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_lo, user_hi),
  check (user_lo < user_hi)
);
alter table public.friendships enable row level security;

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references auth.users (id) on delete cascade,
  to_user uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  message text,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (from_user <> to_user)
);
-- At most one *pending* request per direction (prevents duplicates).
create unique index if not exists friend_requests_pending_uniq
  on public.friend_requests (from_user, to_user) where status = 'pending';
alter table public.friend_requests enable row level security;

create table if not exists public.blocks (
  blocker uuid not null references auth.users (id) on delete cascade,
  blocked uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);
alter table public.blocks enable row level security;

-- ---------------------------------------------------------------------------
-- Helper predicates (SECURITY DEFINER so policies can use them)
-- ---------------------------------------------------------------------------

create or replace function public.are_friends(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.friendships f
    where f.user_lo = least(a, b) and f.user_hi = greatest(a, b)
  );
$$;

create or replace function public.is_blocked(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.blocks
    where (blocker = a and blocked = b) or (blocker = b and blocked = a)
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS policies (reads only; all writes happen via the functions below)
-- ---------------------------------------------------------------------------

-- Read your own profile, friends' profiles, and the profile of anyone you have
-- a pending request with (so request lists can show their handle).
create policy "read visible profiles"
  on public.profiles for select to authenticated
  using (
    auth.uid() = user_id
    or public.are_friends(auth.uid(), user_id)
    or exists (
      select 1 from public.friend_requests fr
      where fr.status = 'pending'
        and ((fr.from_user = auth.uid() and fr.to_user = user_id)
          or (fr.to_user = auth.uid() and fr.from_user = user_id))
    )
  );

create policy "insert own profile"
  on public.profiles for insert to authenticated
  with check (auth.uid() = user_id);

create policy "update own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "read own friendships"
  on public.friendships for select to authenticated
  using (auth.uid() = user_lo or auth.uid() = user_hi);

create policy "read own requests"
  on public.friend_requests for select to authenticated
  using (auth.uid() = from_user or auth.uid() = to_user);

create policy "read own blocks"
  on public.blocks for select to authenticated
  using (auth.uid() = blocker);

-- ---------------------------------------------------------------------------
-- Actions (SECURITY DEFINER; rate limits reuse increment_ai_usage)
-- ---------------------------------------------------------------------------

-- Find users by exact/prefix username. Returns limited fields only, never
-- email/phone, excludes self + anyone blocked, and is rate limited.
create or replace function public.search_users(q text)
returns table (user_id uuid, username citext, display_name text)
-- VOLATILE (the default), not STABLE: it writes to the rate-limit counter, and
-- PostgREST runs STABLE functions in a read-only transaction.
language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return; end if;
  if length(coalesce(q, '')) < 2 then return; end if;
  if not public.increment_ai_usage('user_search', 120) then
    raise exception 'Too many searches. Please slow down.';
  end if;
  return query
    select p.user_id, p.username, p.display_name
    from public.profiles p
    -- literal prefix match ("_" in a username is not a wildcard)
    where left(p.username::text, length(q)) = lower(q)
      and p.user_id <> uid
      and not public.is_blocked(uid, p.user_id)
    order by p.username
    limit 10;
end;
$$;

create or replace function public.respond_friend_request(p_request_id uuid, p_action text)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); r public.friend_requests;
begin
  if uid is null then raise exception 'Not signed in.'; end if;
  select * into r from public.friend_requests where id = p_request_id;
  if not found then raise exception 'Request not found.'; end if;
  if r.to_user <> uid then raise exception 'Not your request to respond to.'; end if;
  if r.status <> 'pending' then raise exception 'This request was already handled.'; end if;

  if p_action = 'accept' then
    update public.friend_requests set status = 'accepted', responded_at = now() where id = p_request_id;
    insert into public.friendships (user_lo, user_hi)
      values (least(r.from_user, r.to_user), greatest(r.from_user, r.to_user))
      on conflict do nothing;
  elsif p_action = 'decline' then
    update public.friend_requests set status = 'declined', responded_at = now() where id = p_request_id;
  else
    raise exception 'Invalid action.';
  end if;
end;
$$;

create or replace function public.send_friend_request(p_to_username citext, p_message text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); target uuid; incoming uuid; new_id uuid;
begin
  if uid is null then raise exception 'Not signed in.'; end if;
  if not public.increment_ai_usage('friend_request', 50) then
    raise exception 'Too many requests. Please try again later.';
  end if;

  select user_id into target from public.profiles where username = p_to_username;
  if target is null then raise exception 'No user found with that username.'; end if;
  if target = uid then raise exception 'You can''t add yourself.'; end if;
  if public.is_blocked(uid, target) then raise exception 'Unable to send a request to this user.'; end if;
  if public.are_friends(uid, target) then raise exception 'You''re already friends.'; end if;
  if exists (select 1 from public.friend_requests where from_user = uid and to_user = target and status = 'pending') then
    raise exception 'You already have a pending request to this user.';
  end if;

  -- If they already requested you, accept it instead of creating a duplicate.
  select id into incoming from public.friend_requests
    where from_user = target and to_user = uid and status = 'pending' limit 1;
  if incoming is not null then
    perform public.respond_friend_request(incoming, 'accept');
    return null;
  end if;

  insert into public.friend_requests (from_user, to_user, message)
    values (uid, target, left(p_message, 280)) returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.cancel_friend_request(p_request_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not signed in.'; end if;
  update public.friend_requests set status = 'cancelled', responded_at = now()
    where id = p_request_id and from_user = uid and status = 'pending';
end;
$$;

create or replace function public.remove_friend(p_other uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not signed in.'; end if;
  delete from public.friendships
    where user_lo = least(uid, p_other) and user_hi = greatest(uid, p_other);
  -- NOTE: streak teardown is added in Phase 3 when streak tables exist.
end;
$$;

create or replace function public.block_user(p_other uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not signed in.'; end if;
  if p_other = uid then raise exception 'You can''t block yourself.'; end if;
  insert into public.blocks (blocker, blocked) values (uid, p_other) on conflict do nothing;
  -- End the friendship and any pending requests in both directions.
  delete from public.friendships
    where user_lo = least(uid, p_other) and user_hi = greatest(uid, p_other);
  update public.friend_requests set status = 'cancelled', responded_at = now()
    where status = 'pending'
      and ((from_user = uid and to_user = p_other) or (from_user = p_other and to_user = uid));
end;
$$;

create or replace function public.unblock_user(p_other uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not signed in.'; end if;
  delete from public.blocks where blocker = uid and blocked = p_other;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants: signed-in users only.
-- ---------------------------------------------------------------------------
revoke all on function
  public.search_users(text),
  public.send_friend_request(citext, text),
  public.respond_friend_request(uuid, text),
  public.cancel_friend_request(uuid),
  public.remove_friend(uuid),
  public.block_user(uuid),
  public.unblock_user(uuid)
  from public, anon;

grant execute on function
  public.search_users(text),
  public.send_friend_request(citext, text),
  public.respond_friend_request(uuid, text),
  public.cancel_friend_request(uuid),
  public.remove_friend(uuid),
  public.block_user(uuid),
  public.unblock_user(uuid)
  to authenticated;
