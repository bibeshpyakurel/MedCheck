import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { DischargeList } from "@/components/demo-kit/discharge-list";
import { DemoSheet } from "@/components/demo-kit/demo-sheet";
import { FallbackBarcode } from "@/components/demo-kit/fallback-barcode";
import { FictionalLabel } from "@/components/demo-kit/fictional-label";
import { PrescriptionLabel } from "@/components/demo-kit/prescription-label";
import { PrintButton } from "@/components/demo-kit/print-button";
import { DISCHARGE_LIST, DRUG_FACTS_LABELS, FALLBACK_BARCODE, PRESCRIPTION_LABEL } from "@/data/demo-documents";
import "./demo-kit.css";

export const metadata: Metadata = {
  title: "Demo kit",
  description: "Printable fictional labels, documents and barcodes for the MedCheck live demo.",
};

// Public and static: no session, no data access.
export default function DemoKitPage() {
  const [bottleA, bottleB] = DRUG_FACTS_LABELS;
  const items: { id: string; name: string; caption: ReactNode; node: ReactNode }[] = [
    {
      id: bottleA.id,
      name: `${bottleA.nickname} — Calmora Fever Relief`,
      caption: "Scan the barcode, then photograph the Drug Facts panel when the app asks.",
      node: <FictionalLabel label={bottleA} />,
    },
    {
      id: bottleB.id,
      name: `${bottleB.nickname} — Calmora Extra Fever Relief`,
      caption: "Scan the barcode, then photograph the Drug Facts panel. Same volume, twice the strength of Bottle A.",
      node: <FictionalLabel label={bottleB} />,
    },
    {
      id: PRESCRIPTION_LABEL.id,
      name: "Prescription label — Riverside Community Pharmacy",
      caption: "Add a medicine → Photo. Directions are in teaspoons; the strength is 160 mg per 5 mL.",
      node: <PrescriptionLabel />,
    },
    {
      id: DISCHARGE_LIST.id,
      name: "Discharge list — Lakeside Children's Hospital",
      caption: "Add a medicine → Photo. Lists acetaminophen 160 mg/5 mL in mL, plus one other medicine.",
      node: <DischargeList />,
    },
    {
      id: FALLBACK_BARCODE.id,
      name: "Fallback barcode — NyQuil (real NDC)",
      caption: "Scan this if there is no physical NyQuil box on stage.",
      node: <FallbackBarcode />,
    },
  ];

  return (
    <div className="min-h-dvh bg-background print:bg-white">
      <header className="mx-auto w-full max-w-5xl px-4 pt-6 pb-4 sm:pt-10 print:hidden">
        <Link href="/" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          ← MedCheck
        </Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Demo kit</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground text-pretty">
          Fictional labels and documents for the live demo. Print on US Letter at 100% scale (turn off &quot;fit to
          page&quot;), with background graphics on — each item prints on its own page. Photograph flat, in good light,
          filling the frame.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <PrintButton />
          <p className="text-sm text-muted-foreground">Everything here is synthetic. None of these products exist.</p>
        </div>
        <nav aria-label="Kit contents" className="mt-6">
          <ol className="grid gap-2 sm:grid-cols-2">
            {items.map((item, i) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  className="flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2 text-sm hover:bg-muted"
                >
                  <span className="font-semibold text-primary">{i + 1}</span>
                  {item.name}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-5xl space-y-10 px-4 pb-16 print:max-w-none print:space-y-0 print:p-0">
        {items.map((item, i) => (
          <DemoSheet key={item.id} id={item.id} index={i + 1} total={items.length} caption={item.caption}>
            {item.node}
          </DemoSheet>
        ))}
      </main>
    </div>
  );
}
