import { cn } from "@/lib/utils";

type Tone =
  | "brand"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"
  | "accent";

const tones: Record<Tone, string> = {
  brand: "bg-brand-50 text-brand-700 ring-brand-200",
  success: "bg-success-50 text-success-700 ring-emerald-200",
  warning: "bg-warning-50 text-warning-700 ring-amber-200",
  danger: "bg-danger-50 text-danger-700 ring-red-200",
  info: "bg-info-50 text-info-700 ring-blue-200",
  neutral: "bg-ink-100 text-ink-600 ring-ink-200",
  accent: "bg-accent-50 text-accent-700 ring-violet-200",
};

export function Badge({
  tone = "neutral",
  className,
  children,
  dot = false,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        tones[tone],
        className,
      )}
    >
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}
