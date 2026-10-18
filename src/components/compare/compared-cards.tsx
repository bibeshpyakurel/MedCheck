// The compared medicines side by side: name, ingredients with strength as printed, form, source, and
// whether its values are confirmed. Strengths sit next to each other and are never added up.
import type { ComparedCard, MedicineStatus } from "@/lib/compare-view";
import { cn } from "@/lib/utils";

const CHIPS: Record<MedicineStatus, { text: string; className: string }> = {
  confirmed: { text: "Confirmed", className: "border bg-surface text-foreground" },
  needs_confirmation: { text: "Needs confirmation", className: "border border-unresolved/35 bg-unresolved-surface text-unresolved-foreground" },
  waiting_for_review: { text: "Waiting for review", className: "border border-unresolved/35 bg-unresolved-surface text-unresolved-foreground" },
};

/** Neutral when confirmed (never green), violet when something still needs the user. */
export function StatusChip({ status }: { status: MedicineStatus }) {
  const chip = CHIPS[status];
  return <span className={cn("inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-semibold", chip.className)}>{chip.text}</span>;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function ComparedCards({ cards }: { cards: ComparedCard[] }) {
  const two = cards.length === 2;
  return (
    <ul
      aria-label="Compared medicines"
      className={cn(
        "gap-2",
        two ? "grid grid-cols-2" : "-mx-5 flex snap-x snap-mandatory overflow-x-auto px-5 pb-1 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0",
      )}
    >
      {cards.map((c) => (
        <li key={c.id} className={cn("flex min-w-0 flex-col gap-1.5 rounded-2xl border bg-card p-3.5 shadow-xs", !two && "w-44 shrink-0 snap-start md:w-auto")}>
          <span aria-hidden className="text-xs font-semibold text-muted-foreground">
            {c.letter}
          </span>
          <span className="leading-snug font-semibold text-balance">{c.name}</span>
          <ul className="space-y-1.5">
            {c.ingredients.map((i, n) => (
              <li key={n}>
                <span className="block text-sm">{i.name}</span>
                {i.strength && <span className="block text-base leading-tight font-bold nums">{i.strength}</span>}
              </li>
            ))}
          </ul>
          {c.form && <span className="text-sm text-muted-foreground">{capitalize(c.form)}</span>}
          <span className="text-sm text-muted-foreground">
            {c.source}
            {c.date ? ` · ${c.date}` : ""}
          </span>
          <StatusChip status={c.status} />
        </li>
      ))}
    </ul>
  );
}
