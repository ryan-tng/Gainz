import { NextResponse } from "next/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Best-effort per-IP rate limit. This endpoint is unauthenticated (public signup),
// so there's no user id to key on. The map lives in the serverless instance's
// memory, so it only blunts bursts hitting the same warm instance — it's not a
// hard global cap, but it stops a single client from hammering the Kit API. For
// a strict cap you'd move this to Redis/Upstash or a Vercel edge KV.
const WINDOW_MS = 60_000; // 1 minute
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  // Opportunistic cleanup so the map doesn't grow unbounded.
  if (hits.size > 5_000) {
    for (const [k, v] of hits) {
      if (v.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
    }
  }
  return recent.length > MAX_PER_WINDOW;
}

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a minute." },
      { status: 429 },
    );
  }

  let email: unknown;
  try {
    ({ email } = await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 },
    );
  }

  const apiKey = process.env.KIT_API_KEY;
  const formId = process.env.KIT_FORM_ID;

  if (!apiKey || !formId) {
    // Misconfiguration — log server-side, keep the client message generic.
    console.error("KIT_API_KEY or KIT_FORM_ID is not set.");
    return NextResponse.json(
      { error: "The waitlist isn't available right now. Please try again later." },
      { status: 500 },
    );
  }

  try {
    // Kit (ConvertKit) v3 — subscribe an email to a form.
    const res = await fetch(
      `https://api.convertkit.com/v3/forms/${formId}/subscribe`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: apiKey, email: email.trim() }),
      },
    );

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("Kit subscribe failed:", res.status, detail);
      return NextResponse.json(
        { error: "We couldn't add you just now. Please try again in a moment." },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Kit subscribe error:", err);
    return NextResponse.json(
      { error: "We couldn't add you just now. Please try again in a moment." },
      { status: 502 },
    );
  }
}
