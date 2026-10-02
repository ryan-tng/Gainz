"""Gainz ML service (FastAPI).

A small Python microservice for machine-learning features the app calls over HTTP.
Currently: adaptive TDEE (fits maintenance calories from weight trend + intake).

Run locally:
    pip install -r requirements.txt
    uvicorn main:app --host 0.0.0.0 --port 8000
"""
from __future__ import annotations

import os

from fastapi import FastAPI
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


@app.post("/adaptive-tdee")
def adaptive_tdee(req: AdaptiveTdeeRequest) -> dict:
    result = compute_adaptive_tdee(
        weights=[w.model_dump() for w in req.weights],
        intake=[i.model_dump() for i in req.intake],
        goal_rate_lb_per_week=req.goalRateLbPerWeek,
    )
    return result.to_dict()
