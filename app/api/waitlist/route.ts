import { NextResponse } from "next/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  let email: unknown;
  try {
    ({ email } = await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 },
    );
  }

  const apiKey = process.env.KIT_API_KEY;
  const formId = process.env.KIT_FORM_ID;

  if (!apiKey || !formId) {
    // Misconfiguration — log server-side, keep the client message generic.
    console.error("KIT_API_KEY or KIT_FORM_ID is not set.");
    return NextResponse.json(
      { error: "The waitlist isn't available right now. Please try again later." },
      { status: 500 },
    );
  }

  try {
    // Kit (ConvertKit) v3 — subscribe an email to a form.
    const res = await fetch(
      `https://api.convertkit.com/v3/forms/${formId}/subscribe`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: apiKey, email: email.trim() }),
      },
    );

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("Kit subscribe failed:", res.status, detail);
      return NextResponse.json(
        { error: "We couldn't add you just now. Please try again in a moment." },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Kit subscribe error:", err);
    return NextResponse.json(
      { error: "We couldn't add you just now. Please try again in a moment." },
      { status: 502 },
    );
  }
}
