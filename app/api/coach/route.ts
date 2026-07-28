import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

// Coaching is reasoning-heavy, so we use the strongest model.
const MODEL = "claude-opus-4-8";

/**
 * Structured-output schema — Claude is constrained to return exactly this shape,
 * so the mobile app can render it without defensive parsing.
 */
const COACH_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    headline: {
      type: "string",
      description: "One short, direct sentence summarizing the plan's outlook.",
    },
    feasibility: {
      type: "string",
      enum: ["conservative", "realistic", "aggressive", "unsafe"],
      description: "How achievable the requested rate is for this person.",
    },
    assessment: {
      type: "string",
      description:
        "2-3 sentences assessing the goal, referencing the user's actual numbers and logging/training history.",
    },
    recommendedCalories: {
      type: "integer",
      description:
        "The daily calorie target you recommend. Usually matches the computed target; differ only with a clear reason.",
    },
    adjustment: {
      type: "string",
      description:
        "Why your recommendation matches or differs from the computed target. One or two sentences.",
    },
    focus: {
      type: "array",
      description: "3-4 concrete, actionable focus areas for the next few weeks.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string", description: "Short label, 2-4 words." },
          detail: { type: "string", description: "One or two specific, actionable sentences." },
        },
        required: ["title", "detail"],
      },
    },
    training: {
      type: "string",
      description:
        "Training guidance tailored to their current workout frequency and the goal direction.",
    },
    warning: {
      type: "string",
      description:
        "A safety caveat if the plan is aggressive/unsafe or data is too sparse. Empty string if none.",
    },
  },
  required: [
    "headline",
    "feasibility",
    "assessment",
    "recommendedCalories",
    "adjustment",
    "focus",
    "training",
    "warning",
  ],
} as const;

const SYSTEM = `You are an evidence-based fitness and nutrition coach inside a workout-tracking app.

You will receive a user's profile, a calorie target already computed with the Mifflin-St Jeor equation, and a summary of their recent training and food logging.

Rules:
- The provided maintenance and target calories come from a validated formula. Treat them as the baseline and reason FROM them. Do not recompute BMR yourself or invent conflicting numbers.
- Only recommend a calorie number different from the computed target when there is a clear, stated reason (e.g. the requested rate is unsafely fast, or their logged intake is wildly off target). Explain any change plainly.
- Never recommend below 1500 kcal/day for men or 1200 kcal/day for women.
- Rates above ~1% of bodyweight per week are aggressive; above ~1.5% is unsafe. Flag these honestly.
- Ground your advice in the numbers you were given. Reference their actual training frequency and logging consistency. If data is sparse, say so rather than inventing detail.
- Be direct, specific, and encouraging. No filler, no hedging, no medical claims.
- You are not a doctor. If the goal appears medically risky, say so and suggest consulting a professional.`;

interface CoachRequest {
  goal?: Record<string, unknown>;
  weeksToGoal?: unknown;
  recent?: Record<string, unknown>;
}

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

export async function POST(request: Request) {
  let body: CoachRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const goal = body.goal;
  if (!goal || typeof goal !== "object") {
    return NextResponse.json({ error: "Missing goal data." }, { status: 400 });
  }

  // Require the core numbers the model needs to reason from.
  const currentWeightLb = num(goal.currentWeightLb);
  const targetWeightLb = num(goal.targetWeightLb);
  const maintenanceCalories = num(goal.maintenanceCalories);
  const targetCalories = num(goal.targetCalories);
  if (
    currentWeightLb === null ||
    targetWeightLb === null ||
    maintenanceCalories === null ||
    targetCalories === null
  ) {
    return NextResponse.json({ error: "Incomplete goal data." }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set.");
    return NextResponse.json(
      { error: "Coaching isn't configured right now." },
      { status: 500 },
    );
  }

  const client = new Anthropic();

  const payload = {
    profile: {
      sex: goal.sex,
      age: goal.age,
      heightIn: goal.heightIn,
      currentWeightLb,
      targetWeightLb,
      activityLevel: goal.activity,
      requestedWeeklyRateLb: goal.weeklyRateLb,
    },
    computedByFormula: {
      equation: "Mifflin-St Jeor",
      maintenanceCalories,
      targetCalories,
      proteinTargetG: goal.proteinTargetG,
      carbsTargetG: goal.carbsTargetG,
      fatTargetG: goal.fatTargetG,
      estimatedWeeksToGoal: body.weeksToGoal ?? null,
    },
    recentActivity: body.recent ?? null,
  };

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Here is my data. Give me a coaching plan.\n\n${JSON.stringify(payload, null, 2)}`,
        },
      ],
      output_config: { format: { type: "json_schema", schema: COACH_SCHEMA } },
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json(
        { error: "Couldn't generate a plan for those numbers. Try adjusting your goal." },
        { status: 422 },
      );
    }

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text block in model response.");
    }
    return NextResponse.json(JSON.parse(textBlock.text));
  } catch (err) {
    console.error("coach error:", err);
    return NextResponse.json(
      { error: "We couldn't build your plan right now. Please try again." },
      { status: 502 },
    );
  }
}
