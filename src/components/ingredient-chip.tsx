import { ingredientTone, type IngredientTone } from "@/lib/ingredient-colors";
import { cn } from "@/lib/utils";

// Literal class names, so Tailwind finds them. Tokens: globals.css --ing-1…--ing-8.
const TONES: Record<IngredientTone, string> = {
  overlap: "bg-finding-surface text-finding-foreground ring-1 ring-finding",
  "ing-1": "bg-[var(--ing-1-bg)] text-[var(--ing-1)]",
  "ing-2": "bg-[var(--ing-2-bg)] text-[var(--ing-2)]",
  "ing-3": "bg-[var(--ing-3-bg)] text-[var(--ing-3)]",
  "ing-4": "bg-[var(--ing-4-bg)] text-[var(--ing-4)]",
  "ing-5": "bg-[var(--ing-5-bg)] text-[var(--ing-5)]",
  "ing-6": "bg-[var(--ing-6-bg)] text-[var(--ing-6)]",
  "ing-7": "bg-[var(--ing-7-bg)] text-[var(--ing-7)]",
  "ing-8": "bg-[var(--ing-8-bg)] text-[var(--ing-8)]",
};

/**
 * One active ingredient with its own strength, exactly as confirmed: "Acetaminophen 325 mg per 15 mL".
 * Every spelling of an ingredient has one color on every screen; a shared ingredient is amber.
 * Strengths sit side by side on their own chips and are never added up.
 */
export function IngredientChip({
  name,
  strength,
  overlapping,
  className,
}: {
  name: string;
  strength: string | null;
  /** Normalized names of the shared ingredients (overlappingIngredients()). */
  overlapping: ReadonlySet<string>;
  className?: string;
}) {
  const tone = ingredientTone(name, overlapping);
  return (
    <span
      className={cn(
        "inline-block max-w-full rounded-lg px-2.5 py-1 text-sm leading-snug font-medium nums",
        TONES[tone] ?? TONES["ing-8"],
        className,
      )}
    >
      {name} <span className="font-normal">{strength ?? "· strength unknown"}</span>
      {tone === "overlap" ? <span className="sr-only"> (shared with another medicine)</span> : null}
    </span>
  );
}
