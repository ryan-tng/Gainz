-- ============================================================================
-- Gainz — username availability check
-- Run AFTER social.sql.
--
-- Profiles are only readable by yourself/friends (RLS), so the app can't see
-- whether someone else already has a handle. This returns just true/false for
-- one exact handle (your own current handle counts as available). Rate limited
-- like search_users so it can't be used to enumerate accounts quickly.
-- ============================================================================

create or replace function public.username_available(p_username text)
returns boolean
-- VOLATILE: it writes to the rate-limit counter.
language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := auth.uid(); q text := lower(trim(coalesce(p_username, '')));
begin
  if uid is null then raise exception 'Not signed in.'; end if;
  if q !~ '^[a-z0-9_]{3,20}$' then return false; end if;
  if not public.increment_ai_usage('username_check', 300) then
    raise exception 'Too many checks. Please slow down.';
  end if;
  return not exists (
    select 1 from public.profiles where username = q::citext and user_id <> uid
  );
end;
$$;

revoke all on function public.username_available(text) from public, anon;
grant execute on function public.username_available(text) to authenticated;
