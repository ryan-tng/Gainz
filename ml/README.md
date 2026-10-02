# Gainz ML service

A small Python (FastAPI) microservice for machine-learning features the mobile app
calls over HTTP. Kept separate from the Next.js backend so ML deps stay isolated.

## Features
- **Adaptive TDEE** (`POST /adaptive-tdee`) — fits the user's real maintenance
  calories from their body-weight trend vs logged intake (least-squares regression,
  energy-balance model). Returns a recommended daily target for their goal rate.

## Run locally
```bash
cd ml
python -m venv .venv
.venv\Scripts\activate        # Windows  (source .venv/bin/activate on macOS/Linux)
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```
`--host 0.0.0.0` is required so your phone can reach it over the LAN.

Then point the app at it: set `EXPO_PUBLIC_ML_URL` in `mobile/.env` to
`http://<your-PC-LAN-IP>:8000` and restart Expo with `npx expo start -c`.

Quick check: open `http://<your-PC-LAN-IP>:8000/health` in your phone browser →
`{"ok": true, "service": "gainz-ml"}`.

## API
`POST /adaptive-tdee`
```json
{
  "weights": [{ "at": 1700000000000, "lb": 185.0 }],
  "intake":  [{ "at": 1700000000000, "kcal": 2200 }],
  "goalRateLbPerWeek": -1.0
}
```
Response:
```json
{
  "maintenance_calories": 2492,
  "recommended_target": 1992,
  "trend_lb_per_week": -0.56,
  "avg_intake": 2211,
  "days_analyzed": 27,
  "confidence": "high",
  "needs_more_data": false,
  "note": "Estimated from your weight trend vs logged intake."
}
```

## Deploy (for real users)
FastAPI deploys easily to **Railway**, **Render**, or **Fly.io** (free tiers):
- Root directory: `ml`
- Build: `pip install -r requirements.txt`
- Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`

Then set `EXPO_PUBLIC_ML_URL` to the deployed URL (in `mobile/.env` and, for the
web build, the Vercel web-app project's env vars).

> Note: Vercel Python functions can also host this, but a dedicated FastAPI host
> (Railway/Render) is simpler and avoids conflicts with the Next.js app.
