"use client";

// The label's per-form directions ("Advil Tablets", "Advil Caplets"): one shown at a time, by the label's own sub-headings.
import { useId, useState } from "react";
import { DirectionBlockView } from "@/components/medicine-card/direction-block";
import type { DirectionBlock } from "@/lib/medication-facts";
import { cn } from "@/lib/utils";

export function DirectionForms({ blocks }: { blocks: DirectionBlock[] }) {
  const [shown, setShown] = useState(0);
  const labelId = useId();
  return (
    <div className="space-y-3">
      <p id={labelId} className="text-sm text-muted-foreground">
        This label has directions for:
      </p>
      <div role="group" aria-labelledby={labelId} className="flex flex-wrap gap-2">
        {blocks.map((b, n) => (
          <button
            key={n}
            type="button"
            aria-pressed={n === shown}
            onClick={() => setShown(n)}
            className={cn(
              "min-h-11 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              n === shown ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-muted",
            )}
          >
            {b.heading?.text}
          </button>
        ))}
      </div>
      <DirectionBlockView block={blocks[shown]} />
    </div>
  );
}
