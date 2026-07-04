import { site } from "@/lib/site";
import { WaitlistForm } from "./WaitlistForm";

export function CtaSection() {
  return (
    <section id="waitlist" className="mx-auto max-w-6xl px-6 py-20 lg:py-28">
      <div className="relative overflow-hidden rounded-3xl border border-border bg-surface px-6 py-14 text-center sm:px-12">
        <div className="glow pointer-events-none absolute inset-x-0 top-0 h-64" />
        <div className="relative mx-auto max-w-xl">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Be first through the door
          </h2>
          <p className="mt-4 text-lg text-muted">
            {site.name} is launching soon. Join the waitlist and we&apos;ll email
            you the moment it&apos;s ready.
          </p>
          <div className="mx-auto mt-8 max-w-md text-left">
            <WaitlistForm />
          </div>
        </div>
      </div>
    </section>
  );
}
