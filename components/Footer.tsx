import { site } from "@/lib/site";
import { Wordmark } from "./Wordmark";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 py-10 sm:flex-row">
        <Wordmark />
        <nav className="flex items-center gap-6 text-sm text-muted">
          <a href="#features" className="transition hover:text-fg">
            Features
          </a>
          <a href="#how-it-works" className="transition hover:text-fg">
            How it works
          </a>
          <a href="#waitlist" className="transition hover:text-fg">
            Waitlist
          </a>
        </nav>
        <p className="text-sm text-muted">
          © {2026} {site.name}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
