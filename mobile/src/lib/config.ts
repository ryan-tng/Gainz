/**
 * Base URL for the Gainz backend (the Next.js app that proxies the AI food
 * scanner + coach to Claude).
 *
 * Set EXPO_PUBLIC_API_BASE_URL to your deployed backend URL for web/production
 * builds. Falls back to a LAN IP for local `npm run dev` testing on a phone.
 */
/** Drop any trailing slash so `${BASE}/path` never produces a double slash. */
const trimSlash = (url: string) => url.replace(/\/+$/, '');

export const API_BASE_URL = trimSlash(
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://192.168.68.51:3000',
);

/**
 * Base URL for the Python ML microservice (FastAPI, in /ml).
 * Local: run `uvicorn main:app --host 0.0.0.0 --port 8000` and use your PC's LAN IP.
 * Production: set EXPO_PUBLIC_ML_URL to the deployed service URL.
 */
export const ML_BASE_URL = trimSlash(
  process.env.EXPO_PUBLIC_ML_URL ?? 'http://192.168.68.51:8000',
);

/**
 * Shared key the ML service checks (X-Gainz-Key header). Set EXPO_PUBLIC_ML_KEY
 * to the same value as the service's ML_SHARED_SECRET. Not strong auth (it ships
 * in the bundle), just a gate against drive-by hits on the public URL. Empty in
 * local dev means no header is sent and the service's gate stays off.
 */
export const ML_KEY = process.env.EXPO_PUBLIC_ML_KEY ?? '';
