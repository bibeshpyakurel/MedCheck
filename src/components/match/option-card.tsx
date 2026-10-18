"use client";

import { matchOptionLabel, type MatchOption } from "@/lib/photo-flow";
import { cn } from "@/lib/utils";

/**
 * One FDA label as a tap-sized radio card: brand, each ingredient with its strength, form, labeler.
 * `name` groups the radios (one group per medicine when a photo shows several).
 */
export function OptionCard({
  option,
  checked,
  onSelect,
  name = "medicine",
}: {
  option: MatchOption;
  checked: boolean;
  onSelect: (id: string) => void;
  name?: string;
}) {
  return (
    <label
      className={cn(
        "flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border p-4 shadow-xs transition-[border-color,background-color] has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
        checked ? "border-primary bg-accent ring-1 ring-primary/30" : "bg-card hover:border-input hover:bg-muted/40",
      )}
    >
      <input
        type="radio"
        name={name}
        aria-label={matchOptionLabel(option)}
        value={option.id}
        checked={checked}
        onChange={() => onSelect(option.id)}
        className="mt-1 size-5 shrink-0 accent-primary"
      />
      <OptionDetails option={option} />
    </label>
  );
}

/** Brand, each ingredient with its strength, then form · labeler (and a strength warning). */
export function OptionDetails({ option, title }: { option: MatchOption; title?: React.ReactNode }) {
  const meta = [option.dosageForm.toLowerCase(), option.labelerName].filter(Boolean).join(" · ");
  return (
    <span className="min-w-0 flex-1 space-y-1">
      <span className="block font-semibold text-pretty">{title ?? option.brandName}</span>
      {option.ingredients.length > 0 && (
        <span className="block space-y-0.5 text-sm nums">
          {option.ingredients.map((i) => (
            <span key={`${i.name}-${i.strength}`} className="block">
              {i.name} {i.strength}
            </span>
          ))}
        </span>
      )}
      {meta && <span className="block text-sm text-muted-foreground">{meta}</span>}
      {option.matchedByCode && <span className="block text-sm font-medium text-primary">Matches the NDC printed on the package.</span>}
      {option.strengthDiffers && (
        <span className="block text-sm text-unresolved-foreground">Strength differs from what MedCheck read on the photo.</span>
      )}
    </span>
  );
}
