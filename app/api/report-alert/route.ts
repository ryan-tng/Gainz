import { createClient } from "@supabase/supabase-js";
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

/**
 * Emails a moderation alert whenever someone reports a photo or a user, so
 * reports get reviewed within 24 hours (App Store Guideline 1.2).
 *
 * Called by Supabase Database Webhooks (Database → Webhooks) on INSERT into
 * public.photo_reports and public.user_reports, with an HTTP header
 * `x-webhook-secret: <REPORT_WEBHOOK_SECRET>`.
 *
 * Env (Vercel):
 *   REPORT_WEBHOOK_SECRET  shared secret the webhook sends (required)
 *   RESEND_API_KEY         Resend API key used to send the email (required)
 *   REPORT_ALERT_TO        where alerts go (default: the support inbox)
 *   REPORT_ALERT_FROM      verified sender (default: Resend's test sender,
 *                          which only delivers to your Resend account's email)
 *   SUPABASE_SERVICE_ROLE_KEY + SUPABASE_URL  to look up usernames / sign a
 *                          photo link for review (optional but recommended)
 */
const SECRET = process.env.REPORT_WEBHOOK_SECRET;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const TO = process.env.REPORT_ALERT_TO ?? "ryant012015.business@gmail.com";
const FROM = process.env.REPORT_ALERT_FROM ?? "Gainz Reports <onboarding@resend.dev>";
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

type Row = Record<string, unknown>;
interface WebhookPayload {
  type?: string;
  table?: string;
  record?: Row;
}

function secretMatches(given: string | null): boolean {
  if (!SECRET || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(SECRET);
  return a.length === b.length && timingSafeEqual(a, b);
}

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export async function POST(request: Request) {
  if (!secretMatches(request.headers.get("x-webhook-secret"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!RESEND_API_KEY) {
    console.error("report-alert: RESEND_API_KEY is not set; report NOT emailed.");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const body = (await request.json().catch(() => ({}))) as WebhookPayload;
  const r = body.record ?? {};
  const table = body.table ?? "unknown";
  const isPhoto = table === "photo_reports";

  // Look up handles and, for photos, a 24h review link (service role bypasses RLS).
  const names: Record<string, string> = {};
  let photoUrl: string | null = null;
  if (SUPABASE_URL && SERVICE_ROLE_KEY) {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const ids = [r.reporter, r.reported_user].filter((x): x is string => typeof x === "string");
    if (ids.length) {
      const { data } = await admin.from("profiles").select("user_id, username").in("user_id", ids);
      for (const p of data ?? []) names[p.user_id as string] = p.username as string;
    }
    if (isPhoto && typeof r.photo_path === "string") {
      const { data } = await admin.storage.from("streak-photos").createSignedUrl(r.photo_path, 60 * 60 * 24);
      photoUrl = data?.signedUrl ?? null;
    }
  }
  const who = (id: unknown) =>
    `${names[String(id)] ? "@" + names[String(id)] : "(no username)"} <code>${esc(id)}</code>`;

  const kind = isPhoto ? "streak photo" : "user";
  const reported = names[String(r.reported_user)] ?? r.reported_username;
  const subject = `[Gainz] New ${kind} report${reported ? ` — @${reported}` : ""}`;
  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:15px;line-height:1.5;color:#111">
      <h2 style="margin:0 0 12px">New ${esc(kind)} report</h2>
      <p style="margin:0 0 12px">Review within 24 hours (App Store Guideline 1.2).</p>
      <table cellpadding="6" style="border-collapse:collapse">
        <tr><td><b>Reported user</b></td><td>${who(r.reported_user)}</td></tr>
        <tr><td><b>Reported by</b></td><td>${who(r.reporter)}</td></tr>
        <tr><td><b>Reason</b></td><td>${esc(r.reason) || "—"}</td></tr>
        <tr><td><b>Report id</b></td><td><code>${esc(r.id)}</code> in <code>${esc(table)}</code></td></tr>
        ${isPhoto ? `<tr><td><b>Photo</b></td><td><code>${esc(r.photo_path)}</code>${photoUrl ? ` — <a href="${esc(photoUrl)}">view (link expires in 24h)</a>` : ""}</td></tr>` : ""}
        <tr><td><b>When</b></td><td>${esc(r.created_at)}</td></tr>
      </table>
      <h3 style="margin:20px 0 6px">How to act</h3>
      <ul style="margin:0;padding-left:20px">
        ${isPhoto ? "<li>Remove the photo: Supabase → Storage → streak-photos → delete the path above.</li>" : ""}
        <li>Offensive username: Supabase → Table editor → profiles → change or delete their row (they'll be asked to pick a new one).</li>
        <li>Ban the account: Supabase → Authentication → Users → find the reported user id → Ban user (or Delete user).</li>
        <li>Mark it handled: set <code>resolved_at</code> on the report row.</li>
      </ul>
    </div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [TO], subject, html }),
  });
  if (!res.ok) {
    console.error("report-alert: Resend failed", res.status, await res.text().catch(() => ""));
    return NextResponse.json({ error: "Email failed" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
