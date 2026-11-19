-- Gainz security hardening.
-- Run this in your Supabase project's SQL editor (Dashboard → SQL → New query)
-- AFTER schema.sql. It tightens shared-template reads so a signed-in user can
-- only fetch a template by its exact code, not enumerate every shared template.

-- ---------- Shared templates: code-lookup only ----------

-- Drop the old "anyone signed in can read any row" policy. With it gone and no
-- other SELECT policy, direct `select * from shared_templates` returns nothing;
-- the SECURITY DEFINER function below is the only way in, and it requires the
-- caller to already know the exact code.
drop policy if exists "Signed-in users read shares" on public.shared_templates;

-- Look up exactly one shared template by its code. Runs as the function owner
-- (bypassing RLS) but only ever returns the single row whose code matches, so a
-- caller can't dump the table — they can only resolve a code they already hold.
create or replace function public.get_shared_template(p_code text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select template
  from public.shared_templates
  where code = upper(trim(p_code))
  limit 1;
$$;

-- Only signed-in users may call it; never anon.
revoke all on function public.get_shared_template(text) from public;
grant execute on function public.get_shared_template(text) to authenticated;
