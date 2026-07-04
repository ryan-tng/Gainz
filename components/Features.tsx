import { features } from "@/lib/site";
import { iconMap } from "./Icons";

export function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-6 py-20 lg:py-28">
      <div className="max-w-2xl">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Everything you need to train with intent
        </h2>
        <p className="mt-4 text-lg text-muted">
          Four tools that used to live in four different apps — now working
          together in one.
        </p>
      </div>

      <div className="mt-12 grid gap-5 sm:grid-cols-2">
        {features.map((f) => {
          const Icon = iconMap[f.icon];
          return (
            <div
              key={f.title}
              className="group rounded-2xl border border-border bg-surface p-6 transition hover:border-accent/40 hover:bg-surface-2"
            >
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-accent/12 text-accent transition group-hover:bg-accent group-hover:text-bg">
                <Icon className="h-5.5 w-5.5" />
              </span>
              <h3 className="mt-4 text-lg font-semibold text-fg">{f.title}</h3>
              <p className="mt-2 leading-relaxed text-muted">{f.body}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
