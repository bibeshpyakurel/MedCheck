// "Together": the active ingredients of two or more medicines side by side, what they share and which
// belong to one family, each in the labels' own words (a warning, or each label's Purpose line).
// Evidence only: never "safe", never green, no dose maths. No "use client": it renders on the server
// and inside a client sheet alike.
import { TriangleAlertIcon } from "lucide-react";
import type { ReactNode } from "react";
import { type ComparedProduct, compareProducts, type ProductComparison } from "@/lib/compare";
import { capitalize, joinList } from "@/lib/checks/shared";

export const NOTHING_SHARED_LINE = "No shared active ingredient found in confirmed fields.";

type Ingredient = ProductComparison["ingredients"][number];

/** `diagramOnly`: just the Venn or grid, when the shared and family notes are shown elsewhere (the compare sheet's findings). */
export function IngredientComparison({ products, diagramOnly = false }: { products: ComparedProduct[]; diagramOnly?: boolean }) {
  const c = compareProducts(products);
  if (c.products.length < 2) return null;
  if (diagramOnly) return c.products.length === 2 ? <Venn comparison={c} /> : <Grid comparison={c} />;
  const nameOf = (id: string) => c.products.find((p) => p.id === id)?.name ?? "";
  const all = (n: number) => (n === 2 ? "both" : "all");

  return (
    <div className="space-y-4">
      {c.shared.map((s) => (
        <Callout key={s.normalized} title={`${joinList(s.productIds.map(nameOf))} ${all(s.productIds.length)} contain ${s.normalized}`} quote={s.labelQuote} />
      ))}
      {c.families.map((f) => {
        const names = [...new Set(f.members.map((m) => m.normalized))];
        const title = `${capitalize(joinList(names))} are ${all(names.length)} ${f.name}`;
        if (f.evidence.kind === "warning") return <Callout key={f.familyId} title={title} quote={f.evidence.quote} />;
        return (
          <Callout key={f.familyId} title={title} quote={null}>
            <figure className="rounded-xl bg-finding-surface p-3.5 ring-1 ring-finding/25">
              <figcaption className="text-sm font-semibold text-finding-foreground">Each label&apos;s own words:</figcaption>
              <ul className="mt-1 space-y-1 leading-relaxed">
                {f.evidence.quotes.map((q) => (
                  <li key={q.product}>
                    <span className="font-medium">{nameOf(q.product)}</span> — {q.heading}: {quoted(q.quote)}
                  </li>
                ))}
              </ul>
            </figure>
          </Callout>
        );
      })}
      {c.shared.length === 0 && c.families.length === 0 && <p className="text-muted-foreground">{NOTHING_SHARED_LINE}</p>}

      {c.products.length === 2 ? <Venn comparison={c} /> : <Grid comparison={c} />}
    </div>
  );
}

/** A fragment cut from under a heading ("take other drugs containing …") reads as one: "…take other …". */
const quoted = (q: string) => `“${/^[a-z]/.test(q) ? "…" : ""}${q}”`;

function Callout({ title, quote, children }: { title: string; quote: string | null; children?: ReactNode }) {
  return (
    <article className="space-y-3 rounded-2xl border border-l-4 border-finding/35 border-l-finding bg-card p-4 text-card-foreground sm:p-5">
      <div className="flex items-start gap-3">
        <TriangleAlertIcon aria-hidden className="mt-0.5 size-5 shrink-0 text-finding" />
        <h3 className="text-base leading-snug font-semibold text-balance sm:text-lg">{title}</h3>
      </div>
      {quote && (
        <figure className="rounded-xl bg-finding-surface p-3.5 ring-1 ring-finding/25">
          <figcaption className="text-sm font-semibold text-finding-foreground">The label&apos;s own warning</figcaption>
          <blockquote className="mt-1 leading-relaxed">{quoted(quote)}</blockquote>
        </figure>
      )}
      {children}
    </article>
  );
}

/**
 * Two overlapping rounded shapes: stacked on a phone (A on top, the overlap "In both", B below),
 * side by side once the container is wide enough. The shapes are decoration; the three regions are
 * headed lists, so a screen reader gets the same content.
 */
function Venn({ comparison: c }: { comparison: ProductComparison }) {
  const [a, b] = c.products;
  const only = (column: 0 | 1) => c.ingredients.filter((i) => i.perProduct[column] !== null && i.perProduct[1 - column] === null);
  const both = c.ingredients.filter((i) => i.perProduct[0] !== null && i.perProduct[1] !== null);
  const shape = "rounded-[2rem] border-2 @lg:rounded-[3rem]";

  return (
    <div className="@container">
      <div className="grid grid-cols-1 grid-rows-[auto_auto_auto] @lg:grid-cols-3 @lg:grid-rows-1">
        <div aria-hidden className={`col-start-1 row-start-1 row-end-3 border-primary/50 bg-primary/[0.07] @lg:col-end-3 @lg:row-end-2 ${shape}`} />
        <div
          aria-hidden
          className={`col-start-1 row-start-2 row-end-4 border-muted-foreground/50 bg-muted-foreground/[0.07] @lg:col-start-2 @lg:col-end-4 @lg:row-start-1 @lg:row-end-2 ${shape}`}
        />
        <Region className="col-start-1 row-start-1 pt-5 pb-4 @lg:pt-6 @lg:pb-6" title={`Only in ${a.name}`} items={only(0)} lines={(i) => [i.perProduct[0] ?? ""]} />
        <Region
          className="col-start-1 row-start-2 py-4 @lg:col-start-2 @lg:row-start-1 @lg:py-6"
          title="In both"
          items={both}
          lines={(i) => [`${a.name}: ${i.perProduct[0]}`, `${b.name}: ${i.perProduct[1]}`]}
          strong
        />
        <Region
          className="col-start-1 row-start-3 pt-4 pb-5 @lg:col-start-3 @lg:row-start-1 @lg:pt-6 @lg:pb-6"
          title={`Only in ${b.name}`}
          items={only(1)}
          lines={(i) => [i.perProduct[1] ?? ""]}
        />
      </div>
    </div>
  );
}

function Region({
  className,
  title,
  items,
  lines,
  strong = false,
}: {
  className: string;
  title: string;
  items: Ingredient[];
  /** The strength text under the ingredient's name, one line each. */
  lines: (i: Ingredient) => string[];
  strong?: boolean;
}) {
  return (
    <section className={`min-w-0 px-6 @lg:px-5 @lg:text-center ${className}`}>
      <h3 className={`text-sm font-semibold break-words ${strong ? "text-foreground" : "text-muted-foreground"}`}>{title}</h3>
      {items.length === 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">None</p>
      ) : (
        <ul className="mt-1.5 space-y-1.5">
          {items.map((i) => (
            <li key={i.normalized} className="break-words">
              <span className="block font-medium">{i.displayName}</span>
              {lines(i).map((l) => (
                <span key={l} className="block text-sm text-muted-foreground nums">
                  {l}
                </span>
              ))}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** One row per ingredient, one column per medicine; shared rows first and tinted. Scrolls sideways inside itself on a phone. */
function Grid({ comparison: c }: { comparison: ProductComparison }) {
  return (
    // `relative` keeps the sr-only cell text inside the scroller, or it widens the page.
    <div className="relative overflow-x-auto rounded-2xl border bg-card">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">Active ingredients in each medicine</caption>
        <thead>
          <tr className="border-b">
            <th scope="col" className="sticky left-0 min-w-32 bg-card px-3 py-3 font-semibold">
              Active ingredient
            </th>
            {c.products.map((p) => (
              <th key={p.id} scope="col" className="min-w-28 px-3 py-3 align-bottom font-semibold">
                {p.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {c.ingredients.map((i) => {
            const count = i.perProduct.filter((s) => s !== null).length;
            const shared = count >= 2;
            const tint = shared ? "bg-finding-surface" : "bg-card";
            return (
              <tr key={i.normalized} className="border-b last:border-0">
                <th scope="row" className={`sticky left-0 px-3 py-3 align-top font-medium ${tint}`}>
                  {i.displayName}
                  {shared && <span className="mt-0.5 block text-xs font-medium text-finding-foreground">In {count} medicines</span>}
                </th>
                {i.perProduct.map((s, col) => (
                  <td key={c.products[col].id} className={`px-3 py-3 align-top ${tint}`}>
                    {s === null ? (
                      <>
                        <span aria-hidden className="text-muted-foreground">
                          —
                        </span>
                        <span className="sr-only">Not in {c.products[col].name}</span>
                      </>
                    ) : (
                      <span className="flex items-start gap-2">
                        <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-foreground" />
                        <span className="nums">
                          <span className="sr-only">Contains, </span>
                          {s}
                        </span>
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
