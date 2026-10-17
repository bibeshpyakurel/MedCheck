import { CheckIcon, XIcon } from "lucide-react";
import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { CHECK_TITLES } from "@/lib/checks";
import type { CheckId } from "@/lib/domain/schema";

export const metadata: Metadata = { title: "About the checks" };

/** What each of the six fixed rules looks for (see docs/superpowers/specs, §6). */
const CHECK_DESCRIPTIONS: Record<CheckId, string> = {
  ingredient_overlap: "Two different medicines list the same active ingredient. The label's own warning is quoted when there is one.",
  repeated_record: "The same product added twice is shown as a repeat, not as two different medicines.",
  concentration: "Two liquids with the same ingredient but different strengths, each shown exactly as printed.",
  units: "Directions and strength that use units that don't line up, like mL and teaspoons.",
  document_vs_bottle: "A discharge list, prescription label and bottle that disagree on strength or directions.",
  database_vs_box: "For a scanned product, the label MedCheck has on file compared with the Drug Facts on the box in your hand.",
};

const DOES = [
  "Shows when two medicines share an active ingredient",
  "Spots strengths and units that don't line up across bottles and documents",
  "Quotes the label's own warning text",
  "Builds a report you can hand to a pharmacist",
];
const NEVER = [
  "Calculates a dose, a volume or a schedule",
  "Says a combination is safe",
  "Picks which bottle or amount is right",
];

// Public and static: no session, no data access.
export default function AboutChecksPage() {
  return (
    <AppShell>
      <PageHeader
        title="About the checks"
        description="Six fixed rules give the same answer every time. Only details you confirmed are checked. If a detail is unknown, the check says what it still needs — it never guesses."
      />
      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(Object.keys(CHECK_TITLES) as CheckId[]).map((id) => (
          <li key={id} className="rounded-2xl border bg-card p-5">
            <h2 className="font-semibold">{CHECK_TITLES[id]}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">{CHECK_DESCRIPTIONS[id]}</p>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm text-muted-foreground">
        Label details for real products come from FDA labels via openFDA. The demo products are made up.
      </p>

      <div className="mt-16 grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Evidence, not advice.</h2>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground text-pretty">
            MedCheck organizes what the labels and documents already say, so the conversation with your pharmacist starts
            from facts. The decision stays with a person who can answer it.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border bg-card p-6">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <CheckIcon aria-hidden className="size-4 text-primary" />
              MedCheck does
            </h3>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed">
              {DOES.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-dashed bg-surface p-6">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <XIcon aria-hidden className="size-4 text-muted-foreground" />
              MedCheck never
            </h3>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
              {NEVER.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
