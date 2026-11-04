export const metadata = {
  title: "Gainz — Privacy Policy",
  description: "How the Gainz app collects, uses, and protects your data.",
};

const UPDATED = "November 3, 2026";
const CONTACT = "support@joingainz.com";

const wrap: React.CSSProperties = {
  maxWidth: 760,
  margin: "0 auto",
  padding: "48px 24px 96px",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  color: "#1a1d21",
  lineHeight: 1.6,
  fontSize: 16,
};
const h1: React.CSSProperties = { fontSize: 30, fontWeight: 800, letterSpacing: -0.5, marginBottom: 4 };
const meta: React.CSSProperties = { color: "#6b7280", fontSize: 14, marginBottom: 32 };
const h2: React.CSSProperties = { fontSize: 20, fontWeight: 700, marginTop: 32, marginBottom: 8 };
const li: React.CSSProperties = { marginBottom: 6 };

export default function PrivacyPolicy() {
  return (
    <main style={wrap}>
      <h1 style={h1}>Privacy Policy</h1>
      <p style={meta}>Gainz · Last updated {UPDATED}</p>

      <p>
        Gainz (&quot;we,&quot; &quot;us,&quot; the &quot;app&quot;) is a workout and nutrition
        tracker. This policy explains what data we collect, how we use it, who we share it with, and
        the choices you have.
      </p>

      <h2 style={h2}>Information we collect</h2>
      <ul>
        <li style={li}>
          <b>Account information:</b> your email address and a password (stored securely, hashed, by
          our authentication provider).
        </li>
        <li style={li}>
          <b>Fitness &amp; nutrition data you enter:</b> workouts, exercises, templates, personal
          records, body weight, food/nutrition logs, goals, and profile details (such as a display
          name and optional profile photo).
        </li>
        <li style={li}>
          <b>Food photos:</b> when you use the AI food scanner, the photo you take is sent to our AI
          provider to estimate calories and macros. Photos are processed for that purpose and are not
          used to build a profile of you.
        </li>
        <li style={li}>
          <b>Coaching inputs:</b> when you request an AI coaching plan, a summary of your goal and
          recent activity is sent to our AI provider to generate the plan.
        </li>
        <li style={li}>
          <b>Barcode &amp; food searches:</b> barcodes and search terms are sent to the Open Food
          Facts database to look up product nutrition.
        </li>
      </ul>

      <h2 style={h2}>How we use your information</h2>
      <ul>
        <li style={li}>To provide the app&apos;s features (tracking, records, goals, scanning).</li>
        <li style={li}>To back up your data to your account and sync it across your devices.</li>
        <li style={li}>To generate AI calorie estimates and coaching plans you request.</li>
        <li style={li}>To send account emails (such as confirmation and password reset).</li>
      </ul>
      <p>We do not sell your personal data, and we do not use it for third-party advertising.</p>

      <h2 style={h2}>Service providers</h2>
      <p>We share data only with providers that help us run the app:</p>
      <ul>
        <li style={li}><b>Supabase</b> — accounts, database, and encrypted cloud backup of your data.</li>
        <li style={li}><b>Anthropic (Claude)</b> — AI food analysis and coaching.</li>
        <li style={li}><b>Open Food Facts</b> — food and barcode nutrition data.</li>
        <li style={li}><b>Vercel</b> and <b>Render</b> — hosting of our backend and machine-learning services.</li>
        <li style={li}><b>Resend</b> — delivery of account emails.</li>
      </ul>

      <h2 style={h2}>Data storage &amp; retention</h2>
      <p>
        Your data is stored on your device and backed up to your account so it can be restored on a
        new device. We keep your data for as long as your account exists. Data is encrypted in
        transit, and access to your account&apos;s records is restricted to you.
      </p>

      <h2 style={h2}>Deleting your account and data</h2>
      <p>
        You can permanently delete your account at any time in the app: <b>Settings → Delete
        account</b>. This removes your account and your cloud backup (workouts, records, nutrition,
        and profile). This action cannot be undone. You can also clear data on a single device with
        Settings → Reset app data.
      </p>

      <h2 style={h2}>Children</h2>
      <p>
        Gainz is not directed to children under 13, and we do not knowingly collect personal
        information from them.
      </p>

      <h2 style={h2}>Changes to this policy</h2>
      <p>
        We may update this policy from time to time. Material changes will be reflected by the
        &quot;Last updated&quot; date above.
      </p>

      <h2 style={h2}>Contact</h2>
      <p>
        Questions about this policy or your data? Email us at{" "}
        <a href={`mailto:${CONTACT}`} style={{ color: "#4d7c0f", fontWeight: 600 }}>
          {CONTACT}
        </a>
        .
      </p>
    </main>
  );
}
