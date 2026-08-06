/**
 * Base URL for the Gainz backend (the Next.js app that proxies the AI food
 * scanner + coach to Claude).
 *
 * LOCAL DEV (current): your PC's LAN IP running `npm run dev`. The phone must be
 * on the same Wi-Fi, the dev server must be running, and port 3000 must be
 * allowed through the PC firewall. `localhost` will NOT work from the phone.
 *
 * PRODUCTION: once you deploy the web app to your own Vercel project, swap this
 * for that URL (e.g. "https://your-project.vercel.app") so the AI works anywhere.
 */
export const API_BASE_URL = "http://192.168.68.51:3000";
