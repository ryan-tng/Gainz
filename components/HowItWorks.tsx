import { steps } from "@/lib/site";

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="border-y border-border bg-surface/40"
    >
      <div className="mx-auto max-w-6xl px-6 py-20 lg:py-28">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            How it works
          </h2>
          <p className="mt-4 text-lg text-muted">
            Three steps from walking in the door to hitting your goal.
          </p>
        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="relative">
              <span className="font-mono text-5xl font-bold text-accent/25">
                {s.n}
              </span>
              <h3 className="mt-2 text-xl font-semibold text-fg">{s.title}</h3>
              <p className="mt-2 leading-relaxed text-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
