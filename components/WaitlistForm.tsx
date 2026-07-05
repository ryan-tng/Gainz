"use client";

import { useId, useState } from "react";
import { ArrowIcon, CheckIcon, SpinnerIcon } from "./Icons";

type Status = "idle" | "submitting" | "success" | "error";

// Pragmatic email check — the server + Kit do the authoritative validation.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function WaitlistForm({ id }: { id?: string }) {
  const inputId = useId();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "submitting") return;

    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setStatus("error");
      setMessage("Please enter a valid email address.");
      return;
    }

    setStatus("submitting");
    setMessage("");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.error || "Something went wrong. Please try again.");
      }

      setStatus("success");
      setMessage("You're on the list! We'll email you when we launch.");
      setEmail("");
    } catch (err) {
      setStatus("error");
      setMessage(
        err instanceof Error ? err.message : "Something went wrong. Please try again.",
      );
    }
  }

  if (status === "success") {
    return (
      <div
        id={id}
        role="status"
        className="flex items-center gap-3 rounded-2xl border border-accent/30 bg-accent/10 px-5 py-4 text-left"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-bg">
          <CheckIcon className="h-5 w-5" />
        </span>
        <p className="text-sm font-medium text-fg">{message}</p>
      </div>
    );
  }

  return (
    <form id={id} onSubmit={handleSubmit} noValidate className="w-full">
      <div className="flex flex-col gap-3 sm:flex-row">
        <label htmlFor={inputId} className="sr-only">
          Email address
        </label>
        <input
          id={inputId}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@email.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (status === "error") setStatus("idle");
          }}
          aria-invalid={status === "error"}
          className="w-full flex-1 rounded-xl border border-border bg-surface px-4 py-3.5 text-fg placeholder:text-muted outline-none transition focus:border-accent/60 focus:ring-2 focus:ring-accent/20"
        />
        <button
          type="submit"
          disabled={status === "submitting"}
          className="group inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3.5 font-semibold text-bg shadow-lg shadow-accent/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-accent/30 hover:brightness-105 active:translate-y-0 active:scale-[0.98] active:brightness-95 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {status === "submitting" ? (
            <>
              <SpinnerIcon className="h-5 w-5" />
              Joining…
            </>
          ) : (
            <>
              Join the waitlist
              <ArrowIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </button>
      </div>
      {status === "error" && (
        <p role="alert" className="mt-2 text-sm text-red-400">
          {message}
        </p>
      )}
      <p className="mt-2 text-xs text-muted">No spam. One email when we launch.</p>
    </form>
  );
}
