"use client";

import { motion } from "motion/react";
import { type OverlapVisual, vennLabel } from "@/lib/overlap-visual";
import { ease, spring } from "@/lib/motion";

// Geometry, in viewBox units (320 × 170): two circles, r 78, centres 84 apart. They meet at x 160,
// y 85 ± 65.73; the lens is one arc of each circle between those points.
const R = 78;
const A = 118;
const B = 202;
const CY = 85;
const LENS = `M160 19.27 A${R} ${R} 0 0 1 160 150.73 A${R} ${R} 0 0 1 160 19.27 Z`;

/**
 * The shared ingredient at a glance: two products as overlapping circles with the shared part in
 * amber, each with its own strength, side by side and never added up. Three or more products are a
 * list joined to one amber ingredient badge instead (a 3-way Venn doesn't read on a phone). The
 * circles slide together once, the first time the card scrolls into view; reduced motion keeps
 * them still. Screen readers get one sentence (`vennLabel`).
 */
export function OverlapVenn({ visual }: { visual: OverlapVisual }) {
  return visual.products.length === 2 ? <TwoWay visual={visual} /> : <ManyWay visual={visual} />;
}

function TwoWay({ visual }: { visual: OverlapVisual }) {
  const [a, b] = visual.products;
  return (
    <motion.div
      role="img"
      aria-label={vennLabel(visual)}
      className="mx-auto w-full max-w-sm select-none"
      initial="apart"
      whileInView="together"
      viewport={{ once: true, amount: 0.6 }}
    >
      <div className="relative" style={{ aspectRatio: "320 / 170" }}>
        <svg viewBox="0 0 320 170" aria-hidden className="absolute inset-0 size-full overflow-visible">
          <motion.circle
            cx={A}
            cy={CY}
            r={R}
            className="fill-ring-a/14 stroke-ring-a"
            strokeWidth={1.5}
            variants={{ apart: { x: -12 }, together: { x: 0, transition: spring.soft } }}
          />
          <motion.circle
            cx={B}
            cy={CY}
            r={R}
            className="fill-ring-b/14 stroke-ring-b"
            strokeWidth={1.5}
            variants={{ apart: { x: 12 }, together: { x: 0, transition: spring.soft } }}
          />
          <motion.path
            d={LENS}
            className="fill-overlap"
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
            // Starts faint rather than hidden, so the overlap still shows if this never animates.
            variants={{
              apart: { opacity: 0.35, scale: 0.8, filter: "drop-shadow(0 0 0px var(--overlap-glow))" },
              together: {
                opacity: 1,
                scale: 1,
                filter: [
                  "drop-shadow(0 0 0px var(--overlap-glow))",
                  "drop-shadow(0 0 14px var(--overlap-glow))",
                  "drop-shadow(0 0 6px var(--overlap-glow))",
                ],
                transition: { delay: 0.15, duration: 0.6, ease: ease.out },
              },
            }}
          />
        </svg>
        {/* Each strength sits in the part of its circle the other doesn't cover (centred at x 82 and 238); the
            ingredient sits low in the lens, clear of both. */}
        <Strength value={a.strength} className="left-[25.6%]" />
        <Strength value={b.strength} className="left-[74.4%]" />
        <span className="absolute top-[80%] left-1/2 max-w-[46%] -translate-1/2 truncate rounded-full bg-finding-surface px-2.5 py-1 text-xs font-semibold text-finding-foreground shadow-sm ring-1 ring-finding">
          {visual.ingredient}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-6 text-sm leading-snug font-semibold">
        <ProductName name={a.name} ring="bg-ring-a" />
        <ProductName name={b.name} ring="bg-ring-b" className="text-right" />
      </div>
    </motion.div>
  );
}

function Strength({ value, className }: { value: string | null; className: string }) {
  return (
    <span className={`absolute top-1/2 w-[22%] -translate-1/2 text-center text-xs leading-tight font-semibold text-balance nums ${className}`}>
      {value ?? "strength unknown"}
    </span>
  );
}

/** Under its circle, marked in the circle's color. */
function ProductName({ name, ring, className = "" }: { name: string; ring: string; className?: string }) {
  return (
    <span className={`flex flex-col gap-1 text-pretty ${className}`}>
      <span aria-hidden className={`h-0.5 w-6 rounded-full ${ring} ${className ? "ml-auto" : ""}`} />
      {name}
    </span>
  );
}

function ManyWay({ visual }: { visual: OverlapVisual }) {
  return (
    <motion.div
      role="img"
      aria-label={vennLabel(visual)}
      className="relative pl-4"
      initial="apart"
      whileInView="together"
      viewport={{ once: true, amount: 0.5 }}
    >
      <span aria-hidden className="absolute top-3 bottom-5 left-[0.4375rem] w-0.5 rounded-full bg-overlap" />
      <span className="relative -ml-4 inline-flex items-center gap-2 rounded-full bg-finding-surface px-3 py-1 text-sm font-semibold text-finding-foreground ring-1 ring-finding">
        <span aria-hidden className="size-2.5 rounded-full bg-overlap shadow-[0_0_8px_var(--overlap-glow)]" />
        {visual.ingredient}
      </span>
      <ul className="mt-2 space-y-1.5">
        {visual.products.map((p, i) => (
          <motion.li
            key={p.entryId}
            className="relative flex items-baseline justify-between gap-3 rounded-xl border bg-card px-3 py-2 text-sm"
            variants={{ apart: { opacity: 0.4, x: 8 }, together: { opacity: 1, x: 0, transition: { ...spring.soft, delay: i * 0.06 } } }}
          >
            <span aria-hidden className="absolute top-1/2 -left-[0.6875rem] h-0.5 w-2.5 bg-overlap" />
            <span className="min-w-0 font-medium">{p.name}</span>
            <span className="shrink-0 text-muted-foreground nums">{p.strength ?? "strength unknown"}</span>
          </motion.li>
        ))}
      </ul>
    </motion.div>
  );
}
