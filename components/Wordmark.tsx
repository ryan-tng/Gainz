import { site } from "@/lib/site";
import { DumbbellIcon } from "./Icons";

export function Wordmark() {
  return (
    <a href="#top" className="inline-flex items-center gap-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-bg">
        <DumbbellIcon className="h-5 w-5" strokeWidth={2} />
      </span>
      <span className="text-lg font-bold tracking-tight text-fg">
        {site.name}
      </span>
    </a>
  );
}
