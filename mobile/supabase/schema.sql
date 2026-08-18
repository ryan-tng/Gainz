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
