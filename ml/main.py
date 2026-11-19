"""Gainz ML service (FastAPI).

A small Python microservice for machine-learning features the app calls over HTTP.
Currently: adaptive TDEE (fits maintenance calories from weight trend + intake).

Run locally:
    pip install -r requirements.txt
    uvicorn main:app --host 0.0.0.0 --port 8000
"""
from __future__ import annotations

import os

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from model import compute_adaptive_tdee

app = FastAPI(title="Gainz ML", version="0.1.0")

# Allow the web app (and dev) to call this from the browser. Native apps ignore CORS.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("ML_ALLOW_ORIGIN", "*")],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Shared-key gate. Set ML_SHARED_SECRET on the service (Render env) and ship the
# same value to the app as EXPO_PUBLIC_ML_KEY; requests must send it in the
# X-Gainz-Key header. This stops drive-by hits on the public URL. It is NOT
# strong auth — the key is embedded in the app and can be extracted — but the
# endpoint is only cheap numpy math, so this just raises the bar past bots. If
# the env var is unset (e.g. local dev) the gate is disabled.
ML_SHARED_SECRET = os.environ.get("ML_SHARED_SECRET", "")


def require_key(x_gainz_key: str | None = Header(default=None)) -> None:
    if ML_SHARED_SECRET and x_gainz_key != ML_SHARED_SECRET:
        raise HTTPException(status_code=401, detail="Invalid or missing key.")


class WeightPoint(BaseModel):
    at: int = Field(..., description="epoch milliseconds")
    lb: float


class IntakePoint(BaseModel):
    at: int = Field(..., description="epoch milliseconds")
    kcal: float


class AdaptiveTdeeRequest(BaseModel):
    weights: list[WeightPoint] = []
    intake: list[IntakePoint] = []
    goalRateLbPerWeek: float = 0.0  # negative = lose, positive = gain


@app.get("/health")
def health() -> dict:
    return {"ok": True, "service": "gainz-ml"}


@app.post("/adaptive-tdee", dependencies=[Depends(require_key)])
def adaptive_tdee(req: AdaptiveTdeeRequest) -> dict:
    result = compute_adaptive_tdee(
        weights=[w.model_dump() for w in req.weights],
        intake=[i.model_dump() for i in req.intake],
        goal_rate_lb_per_week=req.goalRateLbPerWeek,
    )
    return result.to_dict()
