import { CameraIcon, DumbbellIcon } from "./Icons";

// A lightweight CSS/SVG mockup standing in for a real app screenshot.
// Swap for an <Image> of the actual app once screens exist.
export function PhoneMockup() {
  return (
    <div className="relative w-[280px] shrink-0 sm:w-[320px]">
      <div className="absolute -inset-6 -z-10 rounded-[3rem] bg-accent/10 blur-2xl" />
      <div className="rounded-[2.5rem] border border-border bg-surface p-3 shadow-2xl shadow-black/50">
        <div className="overflow-hidden rounded-[2rem] border border-border bg-bg">
          {/* status bar */}
          <div className="flex items-center justify-between px-6 pt-4 text-[10px] text-muted">
            <span>9:41</span>
            <span className="h-1.5 w-16 rounded-full bg-surface-2" />
          </div>

          {/* header */}
          <div className="px-5 pt-5">
            <p className="text-xs text-muted">Today · Push Day</p>
            <p className="mt-1 text-lg font-semibold text-fg">Chest &amp; Triceps</p>
          </div>

          {/* exercise rows */}
          <div className="mt-4 space-y-2 px-5">
            {[
              { name: "Bench Press", sets: "4 × 8", done: true },
              { name: "Incline DB Press", sets: "3 × 10", done: true },
              { name: "Cable Fly", sets: "3 × 12", done: false },
            ].map((ex) => (
              <div
                key={ex.name}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5"
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                    ex.done
                      ? "bg-accent/15 text-accent"
                      : "bg-surface-2 text-muted"
                  }`}
                >
                  <DumbbellIcon className="h-4 w-4" />
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-fg">{ex.name}</p>
                  <p className="text-[11px] text-muted">{ex.sets}</p>
                </div>
                <span
                  className={`h-2 w-2 rounded-full ${
                    ex.done ? "bg-accent" : "bg-border"
                  }`}
                />
              </div>
            ))}
          </div>

          {/* calorie card */}
          <div className="mx-5 mt-4 mb-6 rounded-xl border border-accent/20 bg-gradient-to-br from-accent/10 to-accent-2/5 p-4">
            <div className="flex items-center gap-2 text-accent">
              <CameraIcon className="h-4 w-4" />
              <span className="text-xs font-medium">AI Calorie Scan</span>
            </div>
            <div className="mt-3 flex items-end justify-between">
              <div>
                <p className="text-2xl font-bold text-fg">1,840</p>
                <p className="text-[11px] text-muted">of 2,300 kcal</p>
              </div>
              <span className="rounded-full bg-accent/15 px-2.5 py-1 text-[11px] font-medium text-accent">
                On track
              </span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full w-[80%] rounded-full bg-accent" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
