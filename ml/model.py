"""Adaptive TDEE model.

Estimates a user's *actual* maintenance calories (TDEE) by fitting their body-weight
trend against their logged calorie intake, using an energy-balance model:

    weight change energy per day ≈ (intake - TDEE)
    => TDEE ≈ avg_intake - (weight_slope_lb_per_day * KCAL_PER_LB)

The weight slope comes from an ordinary least-squares linear fit over the log.
Pure numpy — no heavy ML deps — so it deploys small and cold-starts fast.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass

import numpy as np

KCAL_PER_LB = 3500.0
DAY_MS = 86_400_000


@dataclass
class TdeeResult:
    maintenance_calories: int
    recommended_target: int
    trend_lb_per_week: float
    avg_intake: int
    days_analyzed: int
    confidence: str  # "low" | "medium" | "high"
    needs_more_data: bool
    note: str

    def to_dict(self) -> dict:
        return asdict(self)


def _daily_avg_intake(intake: list[dict]) -> tuple[float | None, int]:
    """Sum calories per calendar day, then average the daily totals."""
    by_day: dict[int, float] = {}
    for e in intake:
        day = int(e["at"] // DAY_MS)
        by_day[day] = by_day.get(day, 0.0) + float(e["kcal"])
    if not by_day:
        return None, 0
    return float(np.mean(list(by_day.values()))), len(by_day)


def compute_adaptive_tdee(
    weights: list[dict],
    intake: list[dict],
    goal_rate_lb_per_week: float = 0.0,
) -> TdeeResult:
    weights = sorted(weights, key=lambda w: w["at"])
    avg_intake, logged_days = _daily_avg_intake(intake)

    # Need a couple weeks of data for a trustworthy fit.
    if len(weights) < 4 or avg_intake is None or logged_days < 4:
        return TdeeResult(
            maintenance_calories=0,
            recommended_target=0,
            trend_lb_per_week=0.0,
            avg_intake=int(avg_intake or 0),
            days_analyzed=0,
            confidence="low",
            needs_more_data=True,
            note="Log your weight and food for ~2 weeks to get an adaptive estimate.",
        )

    t0 = weights[0]["at"]
    x = np.array([(w["at"] - t0) / DAY_MS for w in weights], dtype=float)  # days
    y = np.array([w["lb"] for w in weights], dtype=float)

    slope, intercept = np.polyfit(x, y, 1)  # lb per day
    trend_lb_per_week = float(slope * 7.0)

    tdee = avg_intake - slope * KCAL_PER_LB
    target = tdee + (goal_rate_lb_per_week / 7.0) * KCAL_PER_LB
    target = max(target, 1200.0)  # safety floor

    span_days = float(x[-1] - x[0])
    if span_days >= 21 and logged_days >= 14:
        confidence = "high"
    elif span_days >= 10 and logged_days >= 7:
        confidence = "medium"
    else:
        confidence = "low"

    return TdeeResult(
        maintenance_calories=int(round(tdee)),
        recommended_target=int(round(target)),
        trend_lb_per_week=round(trend_lb_per_week, 2),
        avg_intake=int(round(avg_intake)),
        days_analyzed=int(round(span_days)),
        confidence=confidence,
        needs_more_data=False,
        note="Estimated from your weight trend vs logged intake.",
    )
