import { ClipboardCheckIcon, PillIcon, ScanLineIcon, Share2Icon } from "lucide-react";
import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "How MedCheck works" };

const STEPS = [
  {
    icon: ScanLineIcon,
    title: "Add a medicine",
    body: "Scan its barcode, or take or choose a photo of the label.",
  },
  {
    icon: ClipboardCheckIcon,
    title: "Check the details",
    body: "MedCheck shows what it read from the label. Confirm each detail or fix it — nothing counts until you do.",
  },
  {
    icon: PillIcon,
    title: "See your medicines",
    body: "Your medicines are listed in one place, with anything worth asking about — for example, two medicines that share an active ingredient.",
  },
  {
    icon: Share2Icon,
    title: "Share a report",
    body: "Download a medicine report as a PDF, email it, or share it with your pharmacist or doctor.",
  },
];

// Public and static: no session, no data access.
export default function HowItWorksPage() {
  return (
    <AppShell>
      <PageHeader
        title="How MedCheck works"
        description="MedCheck shows what your medicine labels say. It never calculates a dose or says a combination is safe."
      />
      <ol className="mt-8 grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        {STEPS.map((step, i) => (
          <li key={step.title} className="rounded-2xl border bg-card p-5">
            <div className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
                <step.icon aria-hidden className="size-5" />
              </span>
              <h2 className="text-base font-semibold">
                <span className="text-muted-foreground nums">{i + 1}.</span> {step.title}
              </h2>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground text-pretty">{step.body}</p>
          </li>
        ))}
      </ol>
    </AppShell>
  );
}
