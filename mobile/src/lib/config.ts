/**
 * Base URL for the Gainz backend (the Next.js app that proxies the AI food
 * scanner + coach to Claude).
 *
 * Set EXPO_PUBLIC_API_BASE_URL to your deployed backend URL for web/production
 * builds. Falls back to a LAN IP for local `npm run dev` testing on a phone.
 */
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://192.168.68.51:3000';
