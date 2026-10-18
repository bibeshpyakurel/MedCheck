// The active ingredient card: name, amount large, what it is per, and the label's Purpose lines.
import type { MedicationFacts } from "@/lib/medication-facts";

export function IngredientHero({ hero, id }: { hero: MedicationFacts["hero"]; id: string }) {
  if (hero.ingredients.length === 0 && hero.purposes.length === 0) return null;
  return (
    <section aria-labelledby={id} className="space-y-4 rounded-2xl border border-primary/20 bg-accent p-5 text-accent-foreground">
      <h3 id={id} className="text-xs font-semibold tracking-wide uppercase">
        {hero.ingredients.length > 1 ? "Active ingredients" : "Active ingredient"}
      </h3>
      <ul className="space-y-4">
        {hero.ingredients.map((i, n) => (
          <li key={n} className="space-y-1">
            <p className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{i.name}</p>
            <p className="flex flex-wrap items-baseline gap-x-2 text-foreground">
              <span className="font-display text-4xl font-extrabold tracking-tight nums sm:text-5xl">{i.amount}</span>
              {i.per && <span className="text-base font-medium text-accent-foreground">{i.per}</span>}
            </p>
          </li>
        ))}
      </ul>
      {hero.purposes.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium">Purpose, as printed</p>
          <ul className="space-y-0.5 text-base font-semibold text-foreground">
            {hero.purposes.map((p, n) => (
              <li key={n}>{p.text}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
