import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// The Expo web app runs on a different origin than this API, so browsers
// require CORS. Set WEB_APP_ORIGIN to your web app's URL to lock this down;
// defaults to "*" for easy testing.
const ALLOW_ORIGIN = process.env.WEB_APP_ORIGIN ?? "*";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": ALLOW_ORIGIN,
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

export function middleware(req: NextRequest) {
  // Preflight
  if (req.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
  }
  const res = NextResponse.next();
  for (const [k, v] of Object.entries(CORS_HEADERS)) res.headers.set(k, v);
  return res;
}

export const config = { matcher: "/api/:path*" };
