// Pieces the medicine card and its quick answers share. No "use client": server and client alike.
import { PhoneIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

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
