export const metadata = {
  title: "Gainz — Terms of Use",
  description: "The rules for using the Gainz app, including our zero-tolerance policy for objectionable content.",
};

const UPDATED = "November 21, 2026";
const CONTACT = "ryant012015.business@gmail.com";

// Same bright layout as the privacy page.
const page: React.CSSProperties = {
  position: "relative",
  zIndex: 1,
  minHeight: "100vh",
  background: "#ffffff",
  color: "#1a1d21",
};
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
const h1: React.CSSProperties = { fontSize: 30, fontWeight: 800, letterSpacing: -0.5, marginBottom: 4, color: "#0d0f12" };
const meta: React.CSSProperties = { color: "#4b5563", fontSize: 14, marginBottom: 32 };
const h2: React.CSSProperties = { fontSize: 20, fontWeight: 700, marginTop: 32, marginBottom: 8, color: "#0d0f12" };
const li: React.CSSProperties = { marginBottom: 6 };
const link: React.CSSProperties = { color: "#4d7c0f", fontWeight: 600 };

export default function Terms() {
  return (
    <div style={page}>
      <main style={wrap}>
        <h1 style={h1}>Terms of Use</h1>
        <p style={meta}>Gainz · Last updated {UPDATED}</p>

        <p>
          These terms are an agreement between you and Gainz (&quot;we,&quot; &quot;us&quot;) for
          using the Gainz app. By creating an account or using the app, you agree to them. If you
          don&apos;t agree, please don&apos;t use Gainz.
        </p>

        <h2 style={h2}>Your account</h2>
        <ul>
          <li style={li}>You must be at least 13 years old to use Gainz.</li>
          <li style={li}>Keep your password safe. You&apos;re responsible for activity on your account.</li>
          <li style={li}>
            Your username must not impersonate anyone (including Gainz) or be offensive. We may
            change or remove usernames that break these terms.
          </li>
        </ul>

        <h2 style={h2}>Zero tolerance for objectionable content and abusive users</h2>
        <p>
          Gainz lets you add friends, send friend requests, and share workout check-ins and proof
          photos in streaks. <b>There is no tolerance for objectionable content or abusive
          behavior.</b> You agree not to post, send, or share anything that:
        </p>
        <ul>
          <li style={li}>is sexually explicit, includes nudity, or sexualizes anyone, especially minors;</li>
          <li style={li}>harasses, bullies, threatens, or intimidates anyone;</li>
          <li style={li}>is hateful or discriminatory toward any group or person;</li>
          <li style={li}>shows or promotes violence, self-harm, or illegal activity;</li>
          <li style={li}>impersonates another person, or shares someone else&apos;s private information;</li>
          <li style={li}>is spam, or infringes someone else&apos;s rights.</li>
        </ul>

        <h2 style={h2}>Reporting, blocking, and enforcement</h2>
        <ul>
          <li style={li}>
            You can report a photo from a streak&apos;s activity, and report a user from your friends
            list or a friend request. You can block anyone, which also ends your streaks with them.
          </li>
          <li style={li}>
            We review reports within 24 hours. We will remove content that breaks these terms and
            may suspend or permanently remove the account of anyone who posts it.
          </li>
          <li style={li}>
            You can also email us at{" "}
            <a href={`mailto:${CONTACT}`} style={link}>{CONTACT}</a> to report a problem.
          </li>
        </ul>

        <h2 style={h2}>Health and AI features</h2>
        <p>
          Gainz is a tracking tool, not medical advice. Calorie estimates from photos, nutrition
          data, and AI coaching plans can be wrong. Double-check important numbers and talk to a
          doctor before starting a new diet or exercise program. Exercise at your own risk.
        </p>

        <h2 style={h2}>Your content</h2>
        <p>
          You own what you log and share. You give us permission to store and process it only to run
          the app, for example to back up your data and deliver your streak photos to the friend you
          share them with. See our <a href="/privacy" style={link}>Privacy Policy</a> for details.
        </p>

        <h2 style={h2}>Ending your use</h2>
        <p>
          You can stop using Gainz and delete your account at any time in Settings → Delete account.
          We may suspend or end accounts that break these terms.
        </p>

        <h2 style={h2}>Disclaimers</h2>
        <p>
          Gainz is provided &quot;as is,&quot; without warranties of any kind. To the extent the law
          allows, we aren&apos;t liable for indirect or consequential damages from using the app.
          If you downloaded Gainz from the Apple App Store, Apple&apos;s standard Licensed
          Application End User License Agreement also applies, and Apple has no obligation to
          provide support for the app.
        </p>

        <h2 style={h2}>Changes</h2>
        <p>
          We may update these terms. Material changes will be reflected by the &quot;Last
          updated&quot; date above, and continuing to use Gainz means you accept them.
        </p>

        <h2 style={h2}>Contact</h2>
        <p>
          Questions? Email{" "}
          <a href={`mailto:${CONTACT}`} style={link}>{CONTACT}</a>.
        </p>
      </main>
    </div>
  );
}
