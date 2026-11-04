import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/**
 * Permanently deletes the signed-in user's account and their cloud backup.
 * Deleting the auth user cascades to user_backups and ai_usage (both have
 * ON DELETE CASCADE foreign keys), but we also delete the backup row explicitly
 * as a safety net. Requires the service-role key (admin) — server-side only.
 */
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request: Request) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE_KEY) {
    console.error("Account deletion not configured — missing Supabase env vars.");
    return NextResponse.json({ error: "Account deletion isn't available right now." }, { status: 500 });
  }

  const header = request.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!token) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  // Identify the caller from their own JWT (not the admin key).
  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await anon.auth.getUser(token);
  if (userErr || !userData?.user) {
    return NextResponse.json({ error: "Your session has expired. Sign in again." }, { status: 401 });
  }
  const userId = userData.user.id;

  // Admin client deletes the user + their data.
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await admin.from("user_backups").delete().eq("user_id", userId);
  const { error: delErr } = await admin.auth.admin.deleteUser(userId);
  if (delErr) {
    console.error("delete-account error:", delErr);
    return NextResponse.json({ error: "Could not delete your account. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
