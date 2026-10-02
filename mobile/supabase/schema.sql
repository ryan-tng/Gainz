-- Gainz cloud backup schema.
-- Run this in your Supabase project's SQL editor (Dashboard → SQL → New query).
-- It creates one JSON backup row per user, locked down with Row Level Security
-- so each user can only read/write their own data.

create table if not exists public.user_backups (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.user_backups enable row level security;

-- A user may only see their own backup row.
create policy "Users read own backup"
  on public.user_backups for select
  using (auth.uid() = user_id);

-- A user may only create their own backup row.
create policy "Users insert own backup"
  on public.user_backups for insert
  with check (auth.uid() = user_id);

-- A user may only update their own backup row.
create policy "Users update own backup"
  on public.user_backups for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------- Shared workouts (send a template via a short code) ----------

create table if not exists public.shared_templates (
  code text primary key,
  template jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.shared_templates enable row level security;

-- Any signed-in user can create a share...
create policy "Signed-in users create shares"
  on public.shared_templates for insert
  to authenticated
  with check (true);

-- ...and anyone signed in can read a share by its code (codes are random).
create policy "Signed-in users read shares"
  on public.shared_templates for select
  to authenticated
  using (true);

-- ---------- AI usage rate limiting ----------
-- Caps how many paid Claude calls (food scan, coach) a user can make per day,
-- so a single account can't run up the Anthropic bill. The backend calls the
-- increment_ai_usage() function below on every AI request.

create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  feature text not null,
  day date not null default (now() at time zone 'utc')::date,
  count int not null default 0,
  primary key (user_id, feature, day)
);

-- RLS on with no policies: the table is only ever touched by the SECURITY
-- DEFINER function below, never directly by clients.
alter table public.ai_usage enable row level security;

-- Atomically bump today's counter for the calling user + feature and report
-- whether they're still within the limit. auth.uid() comes from the caller's
-- JWT, so a user can only ever affect their own quota.
create or replace function public.increment_ai_usage(p_feature text, p_limit int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  new_count int;
begin
  if uid is null then
    return false;
  end if;
  insert into public.ai_usage (user_id, feature, day, count)
  values (uid, p_feature, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, feature, day)
  do update set count = public.ai_usage.count + 1
  returning count into new_count;
  return new_count <= p_limit;
end;
$$;

-- Only signed-in users may call it; never anon.
revoke all on function public.increment_ai_usage(text, int) from public;
grant execute on function public.increment_ai_usage(text, int) to authenticated;
