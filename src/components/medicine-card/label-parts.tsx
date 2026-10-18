// Pieces the medicine card and its quick answers share. No "use client": server and client alike.
import { ExternalLinkIcon, PhoneIcon } from "lucide-react";
import { Fragment } from "react";
import { Button } from "@/components/ui/button";
import type { SourceLink } from "@/lib/domain/schema";
import type { LabelLine } from "@/lib/medication-facts";

/** A dashboard section's heading and its one-line caption. */
export function SectionHeading({ id, title, caption }: { id: string; title: string; caption?: string }) {
  return (
    <div className="space-y-0.5">
      <h3 id={id} className="font-display text-lg font-semibold tracking-tight">
        {title}
      </h3>
      {caption && <p className="text-sm text-pretty text-muted-foreground">{caption}</p>}
    </div>
  );
}

/** A label line with its marked words highlighted where they stand; the text is never changed. */
export function MarkedLine({ line }: { line: LabelLine }) {
  const parts: { text: string; marked: boolean }[] = [];
  let at = 0;
  for (const [start, end] of line.marks ?? []) {
    if (start > at) parts.push({ text: line.text.slice(at, start), marked: false });
    parts.push({ text: line.text.slice(start, end), marked: true });
    at = end;
  }
  if (at < line.text.length) parts.push({ text: line.text.slice(at), marked: false });
  return (
    <>
      {parts.map((p, i) =>
        p.marked ? (
          <mark key={i} className="rounded-sm bg-accent px-0.5 font-semibold text-accent-foreground">
            {p.text}
          </mark>
        ) : (
          <Fragment key={i}>{p.text}</Fragment>
        ),
      )}
    </>
  );
}

/** The card's sources (DailyMed, MedlinePlus), each opening in a new tab. */
export function SourceLinks({ links }: { links: SourceLink[] }) {
  if (links.length === 0) return null;
  return (
    <ul>
      {links.map((link) => (
        <li key={link.url}>
          <a
            href={link.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            {link.label}
            <ExternalLinkIcon aria-hidden className="size-3.5" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

/** The label's own bullets, as printed. */
export function LabelBullets({ bullets }: { bullets: string[] }) {
  if (bullets.length === 0) return null;
  return (
    <ul className="list-disc space-y-2 pl-5 text-[0.9375rem] leading-relaxed marker:text-muted-foreground">
      {bullets.map((bullet, i) => (
        <li key={i} className="pl-1">
          {bullet}
        </li>
      ))}
    </ul>
  );
}

/** The dosing table, whole, exactly as printed; `html` must arrive sanitized (`rowToFormulation()`). */
export function DosingTable({ html }: { html: string }) {
  return (
    <div className="space-y-2 pt-1">
      <p className="text-sm text-muted-foreground">
        Dosing table, shown in full exactly as printed. MedCheck doesn&apos;t pick a row.
      </p>
      <div
        className="overflow-x-auto rounded-xl border bg-card text-sm shadow-xs [&_table]:w-full [&_table]:border-collapse [&_td]:border-t [&_td]:px-3 [&_td]:py-2.5 [&_td]:align-top [&_th]:bg-surface [&_th]:px-3 [&_th]:py-2.5 [&_th]:text-left [&_th]:font-semibold [&_tr:first-child_td]:border-t-0"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

export function PoisonControlButton() {
  return (
    <Button
      variant="outline"
      nativeButton={false}
      render={<a href="tel:18002221222" />}
      className="h-11 w-full px-4 text-base sm:w-auto"
    >
      <PhoneIcon aria-hidden /> Poison Control 1-800-222-1222
    </Button>
  );
}
