import type { ReactNode } from "react";
import { DEMO_DISCLAIMER } from "@/data/demo-documents";

/** The fictional-demo banner every printed item carries. */
export function DemoDisclaimer({ className = "" }: { className?: string }) {
  return (
    <p
      className={`border-2 border-dashed border-black px-2 py-1 text-center text-xs font-bold tracking-wide uppercase ${className}`}
    >
      {DEMO_DISCLAIMER}
    </p>
  );
}

/**
 * One printed page of the kit: a screen-only caption saying what it is for, then the item itself
 * on a white background so it prints and photographs the same in light and dark mode.
 */
export function DemoSheet({
  id,
  index,
  total,
  caption,
  children,
}: {
  id: string;
  index: number;
  total: number;
  caption: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-caption`} className="demo-kit-page scroll-mt-6">
      <div id={`${id}-caption`} className="mb-3 text-sm text-muted-foreground print:hidden">
        <span className="font-semibold text-foreground">
          {index} of {total}
        </span>{" "}
        · {caption}
      </div>
      <div className="demo-kit-sheet overflow-x-auto [&>*]:mx-auto rounded-xl bg-white p-4 text-black sm:p-8 print:overflow-visible print:rounded-none print:p-0">
        {children}
      </div>
    </section>
  );
}
