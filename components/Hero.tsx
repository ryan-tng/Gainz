import { site } from "@/lib/site";
import { WaitlistForm } from "./WaitlistForm";
import { PhoneMockup } from "./PhoneMockup";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Layered ambient light — slow-drifting blobs for depth. */}
      <div className="glow pointer-events-none absolute inset-x-0 top-0 h-[640px]" />
      <div
        className="ambient-blob pointer-events-none absolute left-[10%] top-[8%] hidden h-64 w-64 rounded-full bg-accent/20 blur-[90px] sm:block"
        aria-hidden
      />
      <div
        className="ambient-blob ambient-blob-2 pointer-events-none absolute right-[8%] top-[26%] hidden h-72 w-72 rounded-full bg-accent-2/15 blur-[90px] sm:block"
        aria-hidden
      />
      {/* Subtle grid texture line at the top. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent" />

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 pt-20 pb-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8 lg:pt-28 lg:pb-24">
        <div className="max-w-xl">
          <span className="rise rise-1 inline-flex items-center gap-2 rounded-full border border-border glass px-3.5 py-1.5 text-xs font-medium text-muted">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
            </span>
            {site.launch} · Early access
          </span>

          <h1 className="rise rise-2 mt-6 font-display text-5xl font-bold uppercase leading-[0.92] tracking-[-0.01em] text-fg sm:text-6xl lg:text-7xl">
            Your entire{" "}
            <span className="text-gradient">gym routine</span>, in one app.
          </h1>

          <p className="rise rise-3 mt-6 max-w-md text-lg leading-relaxed text-muted">
            {site.description}
          </p>

          <div className="rise rise-4 mt-8 max-w-md">
            <WaitlistForm />
          </div>

          {/* Exclusivity / trust signal for a pre-launch waitlist. */}
          <div className="rise rise-5 mt-6 flex items-center gap-3">
            <div className="flex -space-x-2">
              {["from-accent to-accent-2", "from-accent-2 to-accent", "from-accent to-accent-2"].map(
                (g, i) => (
                  <span
                    key={i}
                    className={`h-7 w-7 rounded-full border-2 border-bg bg-gradient-to-br ${g}`}
                  />
                ),
              )}
            </div>
            <p className="text-sm text-muted">
              Join lifters getting <span className="text-fg">early access</span>
            </p>
          </div>
        </div>

        <div className="rise rise-3 flex justify-center lg:justify-end">
          <div className="animate-float">
            <PhoneMockup />
          </div>
        </div>
      </div>
    </section>
  );
}
