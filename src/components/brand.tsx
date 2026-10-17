import { cn } from "@/lib/utils";

/**
 * The MedCheck mark: two overlapping rings — two medicines — with the shared part filled in.
 * That overlap is exactly what MedCheck surfaces.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-8 shrink-0", className)}>
      <defs>
        <linearGradient id="mc-tile" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--brand)" />
          <stop offset="1" stopColor="var(--primary)" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#mc-tile)" />
      <rect x="0.5" y="0.5" width="31" height="31" rx="8.5" fill="none" stroke="white" strokeOpacity="0.18" />
      <circle cx="12.6" cy="16" r="6.4" fill="none" stroke="white" strokeWidth="2" strokeOpacity="0.95" />
      <circle cx="19.4" cy="16" r="6.4" fill="none" stroke="white" strokeWidth="2" strokeOpacity="0.95" />
      <path d="M16 10.47 A6.4 6.4 0 0 1 16 21.53 A6.4 6.4 0 0 1 16 10.47 Z" fill="white" />
    </svg>
  );
}

/** Mark + wordmark. */
export function BrandLogo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <BrandMark className={markClassName} />
      <span className="font-display text-[1.0625rem] font-semibold tracking-tight">MedCheck</span>
    </span>
  );
}
