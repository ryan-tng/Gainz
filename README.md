# Gainz

All-in-one mobile gym workout tracker app with an AI food calorie tracker to tailor calorie
intake to your workout routine and goals. Also includes AI coaching to reach those goals.

> **This repo** currently holds the **waitlist landing page** (shipping first). The mobile app
> is planned as a separate Expo / React Native build.

---

## Waitlist Landing Page

Marketing + waitlist landing page for Gainz, built with Next.js (App Router) + Tailwind CSS,
deployed on Vercel. Emails are collected via Kit (ConvertKit).

### Local development

```bash
npm install
cp .env.example .env.local   # then fill in your Kit credentials
npm run dev                  # http://localhost:3000
```

Without Kit credentials the page still renders and the form validates input; submissions
return a "not available right now" message until `KIT_API_KEY` / `KIT_FORM_ID` are set.

### Environment variables

| Variable       | Where to find it                                                        |
| -------------- | ----------------------------------------------------------------------- |
| `KIT_API_KEY`  | Kit → Settings → Advanced → **API Key** (v3)                            |
| `KIT_FORM_ID`  | Open your Kit form; the numeric ID is in the URL / embed snippet         |

Set both in `.env.local` for local dev and in **Vercel → Project → Settings → Environment
Variables** for production.

### Deploy (Vercel)

1. Push this repo to GitHub.
2. Import it in Vercel (framework auto-detected as Next.js).
3. Add `KIT_API_KEY` and `KIT_FORM_ID` env vars.
4. Deploy — launches on a free `*.vercel.app` URL; attach a custom domain later.

### Structure

- `app/page.tsx` — assembles the landing sections
- `app/api/waitlist/route.ts` — server-side proxy to the Kit subscribe API
- `components/` — Hero, Features, HowItWorks, CtaSection, WaitlistForm, Header, Footer, etc.
- `lib/site.ts` — brand name, tagline, feature copy (change the name here to rebrand)

### Editing the brand / copy

The product name and all marketing copy live in [`lib/site.ts`](lib/site.ts). "Gainz" is a
working title — change `site.name` there and it updates everywhere.
