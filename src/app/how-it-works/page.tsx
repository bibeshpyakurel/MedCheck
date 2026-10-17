import { ClipboardListIcon, CopyIcon, MessageCircleQuestionIcon, ScanLineIcon } from "lucide-react";
import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "How MedCheck works" };

const STEPS = [
  {
    icon: ScanLineIcon,
    title: "Add a medicine",
    body: "Scan the barcode, take a photo of the label or a medicine document, or type or say what it says.",
  },
  {
    icon: ClipboardListIcon,
    title: "Check the details",
    body: "Each detail sits next to where it came from. Nothing counts until you say it matches, change it, or leave it unknown.",
  },
  {
    icon: MessageCircleQuestionIcon,
    title: "See the questions",
    body: "Six fixed rules compare what you confirmed and turn anything worth asking into a question for a pharmacist.",
  },
];

// Public and static: no session, no data access.
export default function HowItWorksPage() {
  return (
    <AppShell>
      <PageHeader
        title="How MedCheck works"
        description="MedCheck reads the label; you check each detail; fixed rules compare what you confirmed."
      />
      <ol className="mt-10 grid gap-4 md:grid-cols-3 md:gap-6">
        {STEPS.map((step, i) => (
          <li key={step.title} className="rounded-2xl border bg-card p-6">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground">
                <step.icon aria-hidden className="size-5" />
              </span>
              <h2 className="text-lg font-semibold">
                <span className="sr-only">Step {i + 1}: </span>
                {step.title}
              </h2>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground text-pretty">{step.body}</p>
          </li>
        ))}
      </ol>

      <div className="mt-14 grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-14">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight">What a finding looks like</h2>
          <p className="mt-3 leading-relaxed text-muted-foreground text-pretty">
            A finding says what MedCheck noticed, quotes the label&apos;s own warning, and gives you a question to ask.
            The exact products, strengths and sources are one tap away. This example uses a made-up demo product.
          </p>
        </div>
        <ProductPreview />
      </div>
    </AppShell>
  );
}

/** A static illustration of what a finding looks like. Uses the fictional demo product. */
function ProductPreview() {
  return (
    <figure
      aria-label="Example of a MedCheck finding"
      className="overflow-hidden rounded-2xl border bg-card shadow-xl ring-1 ring-foreground/5"
    >
      <div className="flex items-center justify-between gap-3 border-b bg-surface px-5 py-3">
        <span className="text-xs font-medium text-muted-foreground">Example finding</span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-finding-surface px-2.5 py-1 text-xs font-semibold text-finding-foreground ring-1 ring-finding/30">
          <span className="size-1.5 rounded-full bg-finding" aria-hidden />
          Same ingredient in two medicines
        </span>
      </div>

      <div className="space-y-4 p-5 sm:p-6">
        <div>
          <p className="font-display text-lg leading-snug font-semibold text-balance">Two medicines list acetaminophen.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Calmora Fever Relief (Bottle A) and Nighttime cold &amp; flu caplets share this active ingredient.
          </p>
        </div>
        <blockquote className="border-l-2 border-finding pl-3 text-sm italic">
          &ldquo;Do not use with any other drug containing acetaminophen.&rdquo;
          <span className="mt-1 block text-xs text-muted-foreground not-italic">— the Bottle A label&apos;s warning</span>
        </blockquote>
        <div className="rounded-xl bg-finding-surface p-4 text-sm ring-1 ring-finding/25">
          <span className="block font-semibold text-finding-foreground">Ask a pharmacist</span>
          <span className="mt-1 block font-medium">
            Calmora Fever Relief (Bottle A) and Nighttime cold &amp; flu caplets both contain acetaminophen. Can they be
            used together, and what should I watch for?
          </span>
          <span aria-hidden className="mt-3 inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1.5 text-xs font-medium shadow-xs">
            <CopyIcon className="size-3.5" /> Copy question
          </span>
        </div>
        <ul aria-label="Label evidence" className="divide-y rounded-xl border text-sm">
          <li className="flex items-baseline justify-between gap-3 px-3.5 py-2.5">
            <span className="font-medium">Calmora Fever Relief (Bottle A)</span>
            <span className="shrink-0 text-muted-foreground nums">100 mg per 5 mL</span>
          </li>
          <li className="flex items-baseline justify-between gap-3 px-3.5 py-2.5">
            <span className="font-medium">Nighttime cold &amp; flu caplets</span>
            <span className="shrink-0 text-muted-foreground nums">325 mg per caplet</span>
          </li>
        </ul>
      </div>
    </figure>
  );
}
