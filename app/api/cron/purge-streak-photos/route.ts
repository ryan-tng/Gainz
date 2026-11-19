import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/**
 * Daily job (see vercel.json "crons"): deletes streak proof photos older than
 * 7 days. Storage policies already hide them from users after 7 days; this
 * actually removes the files so they don't pile up.
 *
 * Vercel calls this with `Authorization: Bearer <CRON_SECRET>` when the
 * CRON_SECRET env var is set. Without it, the route refuses to run.
 */
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: Request) {
  if (!CRON_SECRET || request.headers.get("authorization") !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("purge-streak-photos: missing Supabase env vars.");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let removed = 0;
  for (let i = 0; i < 20; i++) {
    const { data, error } = await admin.rpc("streak_photo_paths", {
      p_older_than_days: 7,
      p_user: null,
    });
    const paths = (data ?? []) as string[];
    if (error) {
      console.error("purge-streak-photos list error:", error);
      return NextResponse.json({ error: "List failed", removed }, { status: 500 });
    }
    if (paths.length === 0) break;
    const { error: rmErr } = await admin.storage.from("streak-photos").remove(paths);
    if (rmErr) {
      console.error("purge-streak-photos remove error:", rmErr);
      return NextResponse.json({ error: "Remove failed", removed }, { status: 500 });
    }
    removed += paths.length;
  }

  return NextResponse.json({ ok: true, removed });
}
