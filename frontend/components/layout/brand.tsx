import { cn } from "@/lib/utils";

/** Original CampusFlow mark: a route between two campus nodes. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-accent-600 shadow-soft",
        className,
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-white">
        <circle cx="5" cy="19" r="2.2" fill="currentColor" />
        <circle cx="19" cy="5" r="2.2" fill="currentColor" />
        <path
          d="M5 19a10 10 0 0 1 5-8.66A10 10 0 0 1 19 5"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeDasharray="0.5 3.2"
        />
        <path
          d="m12.4 10.4 2.1 2.1"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="text-[17px] font-bold tracking-tight text-ink-900">
        Campus<span className="text-brand-600">Flow</span>
      </span>
    </span>
  );
}
