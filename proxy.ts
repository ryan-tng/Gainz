import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// The Expo web app runs on a different origin than this API, so browsers
// require CORS. Set WEB_APP_ORIGIN to your web app's URL(s) to lock this down —
// a single origin or a comma-separated list. Defaults to "*" for easy testing.
//
// Note: native app calls don't send an Origin header and aren't subject to CORS,
// so locking this down only affects browsers; every endpoint still requires a
// valid JWT regardless.
const ALLOW_ORIGIN = process.env.WEB_APP_ORIGIN ?? "*";
const ALLOWED = ALLOW_ORIGIN.split(",").map((o) => o.trim()).filter(Boolean);
const ALLOW_ALL = ALLOWED.includes("*");

/** Pick the Access-Control-Allow-Origin value for this request. */
function resolveOrigin(req: NextRequest): string {
  if (ALLOW_ALL) return "*";
  const origin = req.headers.get("origin");
  if (origin && ALLOWED.includes(origin)) return origin; // reflect the match
  return ALLOWED[0] ?? "*"; // non-matching browser origins get a non-match → blocked
}

function corsHeaders(req: NextRequest): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Origin": resolveOrigin(req),
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Gainz-Key",
    "Access-Control-Max-Age": "86400",
  };
  // When the allow-list is specific, tell caches the response varies by origin.
  if (!ALLOW_ALL) headers["Vary"] = "Origin";
  return headers;
}

export function proxy(req: NextRequest) {
  const headers = corsHeaders(req);
  // Preflight
  if (req.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers });
  }
  const res = NextResponse.next();
  for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
  return res;
}

export const config = { matcher: "/api/:path*" };
