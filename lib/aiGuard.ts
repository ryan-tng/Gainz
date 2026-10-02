import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/**
 * Auth + per-user rate limiting for the paid AI endpoints.
 *
 * Both /api/analyze-food and /api/coach call Claude, which costs money per
 * request. Without this, anyone who knows the URL could spam them and run up
 * the bill. `guardAi` requires a valid Supabase login and enforces a per-user
 * daily cap backed by the `increment_ai_usage` Postgres function (see
 * mobile/supabase/schema.sql).
 *
 * Server-side env (set in .env.local and in Vercel). The anon/publishable key
 * is safe here — identity is proven by the user's JWT, not the key.
 */
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export type GuardResult =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse };

function deny(status: number, error: string): GuardResult {
  return { ok: false, response: NextResponse.json({ error }, { status }) };
}

export async function guardAi(
  request: Request,
  opts: { feature: string; dailyLimit: number },
): Promise<GuardResult> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("Supabase env not set — AI endpoints cannot authenticate requests.");
    return deny(500, "This feature isn't configured right now.");
  }

  // Pull the bearer token the app attaches from the user's Supabase session.
  const header = request.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!token) return deny(401, "Please sign in to use this feature.");

  // A client scoped to this user's JWT: auth.uid() inside the rate-limit
  // function then resolves to them, so one user can't spend another's quota.
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) {
    return deny(401, "Your session has expired. Please sign in again.");
  }
  const userId = userData.user.id;

  const { data: allowed, error: rlErr } = await supabase.rpc("increment_ai_usage", {
    p_feature: opts.feature,
    p_limit: opts.dailyLimit,
  });

  if (rlErr) {
    // The migration may not be applied yet. Auth already blocks anonymous
    // abuse and the Anthropic spend cap bounds the worst case, so fail open
    // rather than breaking the feature — but make the gap loud in the logs.
    console.error("increment_ai_usage RPC failed (rate limit NOT enforced):", rlErr.message);
    return { ok: true, userId };
  }

  if (allowed === false) {
    return deny(429, `Daily limit reached (${opts.dailyLimit}/day). Try again tomorrow.`);
  }

  return { ok: true, userId };
}
