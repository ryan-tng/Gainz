import { Wordmark } from "./Wordmark";

export function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-bg/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Wordmark />
        <nav className="hidden items-center gap-8 text-sm text-muted sm:flex">
          <a href="#features" className="transition hover:text-fg">
            Features
          </a>
          <a href="#how-it-works" className="transition hover:text-fg">
            How it works
          </a>
        </nav>
        <a
          href="#waitlist"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-bg transition hover:brightness-105"
        >
          Join waitlist
        </a>
      </div>
    </header>
  );
}
