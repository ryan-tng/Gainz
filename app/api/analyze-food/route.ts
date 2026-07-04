import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

// Vision model for food → calories. Opus 4.8 is the default; swap to
// "claude-haiku-4-5" here if you want a cheaper/faster model at high volume.
const MODEL = "claude-opus-4-8";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

// Structured-output schema — Claude is constrained to return exactly this shape.
const NUTRITION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          quantity: { type: "string", description: "Estimated portion, e.g. '1 cup' or '2 slices'" },
          calories: { type: "integer" },
          protein_g: { type: "number" },
          carbs_g: { type: "number" },
          fat_g: { type: "number" },
        },
        required: ["name", "quantity", "calories", "protein_g", "carbs_g", "fat_g"],
      },
    },
    total_calories: { type: "integer" },
    total_protein_g: { type: "number" },
    total_carbs_g: { type: "number" },
    total_fat_g: { type: "number" },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    notes: { type: "string", description: "Short caveat about the estimate, if any." },
  },
  required: [
    "items",
    "total_calories",
    "total_protein_g",
    "total_carbs_g",
    "total_fat_g",
    "confidence",
    "notes",
  ],
} as const;

const SYSTEM = `You are a nutrition estimation assistant. Given a photo of food, identify each distinct food item, estimate a reasonable portion size, and estimate calories and macronutrients (protein, carbs, fat in grams). Base totals on the sum of the items. Be realistic and use common serving sizes when portion is ambiguous. If the image does not clearly contain food, return an empty items array with zero totals, confidence "low", and explain in notes.`;

export async function POST(request: Request) {
  let body: { imageBase64?: unknown; mimeType?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { imageBase64, mimeType } = body;
  if (typeof imageBase64 !== "string" || imageBase64.length < 100) {
    return NextResponse.json({ error: "Missing or invalid image." }, { status: 400 });
  }
  const media = typeof mimeType === "string" && ALLOWED_MIME.has(mimeType) ? mimeType : "image/jpeg";

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set.");
    return NextResponse.json(
      { error: "Food scanning isn't configured right now." },
      { status: 500 },
    );
  }

  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: media as "image/jpeg", data: imageBase64 },
            },
            { type: "text", text: "Estimate the nutrition for the food in this image." },
          ],
        },
      ],
      output_config: { format: { type: "json_schema", schema: NUTRITION_SCHEMA } },
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json(
        { error: "Couldn't analyze that image. Try another photo." },
        { status: 422 },
      );
    }

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text block in model response.");
    }
    const parsed = JSON.parse(textBlock.text);
    return NextResponse.json(parsed);
  } catch (err) {
    console.error("analyze-food error:", err);
    return NextResponse.json(
      { error: "We couldn't analyze that photo. Please try again." },
      { status: 502 },
    );
  }
}
