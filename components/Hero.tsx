import { site } from "@/lib/site";
import { WaitlistForm } from "./WaitlistForm";
import { PhoneMockup } from "./PhoneMockup";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="glow pointer-events-none absolute inset-x-0 top-0 h-[600px]" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 pt-20 pb-16 lg:grid-cols-2 lg:gap-8 lg:pt-28 lg:pb-24">
        <div className="max-w-xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 text-xs font-medium text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            {site.launch} · Join the waitlist
          </span>

          <h1 className="mt-5 text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            Your entire <span className="text-gradient">gym routine</span>, in
            one app.
          </h1>

          <p className="mt-5 text-lg leading-relaxed text-muted">
            {site.description}
          </p>

          <div className="mt-8 max-w-md">
            <WaitlistForm />
          </div>
        </div>

        <div className="flex justify-center lg:justify-end">
          <PhoneMockup />
        </div>
      </div>
    </section>
  );
}
