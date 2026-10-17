import {
  ArrowRightIcon,
  CheckIcon,
  ClipboardListIcon,
  CopyIcon,
  MessageCircleQuestionIcon,
  ScanLineIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { startDemo, startOwn } from "@/app/actions/session";
import { AppShell } from "@/components/app-shell";
import { SubmitButton } from "@/components/records/submit-button";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { CHECK_TITLES } from "@/lib/checks";
import type { CheckId } from "@/lib/domain/schema";

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

export default async function Home() {
  const user = await getCurrentUser();

  return (
    <AppShell
      bleed
      actions={
        user ? (
          <Button variant="outline" className="h-11 px-4" nativeButton={false} render={<Link href="/patients" />}>
            My records
          </Button>
        ) : null
      }
    >
      {/* Hero: the job, the limit, and the way in. The buttons must fit above the fold on a phone. */}
      <section className="relative isolate overflow-hidden border-b">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-grid [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]"
        />
        <div
          aria-hidden
          className="absolute -top-48 left-1/2 -z-10 h-[34rem] w-[60rem] -translate-x-1/2 rounded-full bg-brand/14 blur-3xl"
        />
        <div className="mx-auto w-full max-w-3xl px-4 pt-10 pb-14 sm:px-6 sm:pt-20 sm:pb-20 animate-fade-up">
          <h1 className="font-display text-[2.25rem] leading-[1.08] font-semibold tracking-[-0.03em] text-balance sm:text-5xl lg:text-6xl">
            Compare your medicine labels.
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground text-pretty sm:mt-5 sm:text-xl">
            Add a medicine, check the details, and collect questions for a pharmacist.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            {user ? (
              <>
                <Button size="lg" className="h-12 px-6 text-base" nativeButton={false} render={<Link href="/patients" />}>
                  Go to my records <ArrowRightIcon aria-hidden />
                </Button>
                <form action={startDemo}>
                  <SubmitButton variant="outline" size="lg" className="h-12 w-full px-6 text-base" pendingLabel="Opening…">
                    Open the demo household
                  </SubmitButton>
                </form>
              </>
            ) : (
              <>
                <form action={startOwn}>
                  <SubmitButton size="lg" className="h-12 w-full px-6 text-base" pendingLabel="Starting…">
                    Start my records <ArrowRightIcon aria-hidden />
                  </SubmitButton>
                </form>
                <form action={startDemo}>
                  <SubmitButton variant="outline" size="lg" className="h-12 w-full px-6 text-base" pendingLabel="Setting up the demo…">
                    Try the demo
                  </SubmitButton>
                </form>
              </>
            )}
          </div>

          <p className="mt-6 max-w-xl border-l-2 border-primary pl-3 text-sm leading-relaxed text-pretty sm:text-base">
            <strong className="font-semibold">MedCheck compares what labels say.</strong> It doesn&apos;t choose a medicine or
            an amount.
          </p>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            No account needed. The demo uses made-up records for Alex and their son Sam.
          </p>
          <p className="mt-6 text-sm">
            <a href="#how-heading" className="font-medium underline underline-offset-4">
              How MedCheck works
            </a>
            <span aria-hidden className="mx-2 text-muted-foreground">
              ·
            </span>
            <a href="#checks-heading" className="font-medium underline underline-offset-4">
              About the checks
            </a>
          </p>
        </div>
      </section>

      {/* How MedCheck works: the steps, then an example of what a finding looks like. */}
      <section aria-labelledby="how-heading" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <SectionIntro
          id="how-heading"
          title="How MedCheck works"
          body="MedCheck reads the label; you check each detail; fixed rules compare what you confirmed."
        />
        <ol className="mt-10 grid gap-4 md:grid-cols-3 md:gap-6">
          {STEPS.map((step, i) => (
            <li key={step.title} className="rounded-2xl border bg-card p-6">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground">
                  <step.icon aria-hidden className="size-5" />
                </span>
                <h3 className="text-lg font-semibold">
                  <span className="sr-only">Step {i + 1}: </span>
                  {step.title}
                </h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground text-pretty">{step.body}</p>
            </li>
          ))}
        </ol>

        <div className="mt-14 grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-14">
          <div>
            <h3 className="font-display text-2xl font-semibold tracking-tight">What a finding looks like</h3>
            <p className="mt-3 leading-relaxed text-muted-foreground text-pretty">
              A finding says what MedCheck noticed, quotes the label&apos;s own warning, and gives you a question to ask.
              The exact products, strengths and sources are one tap away. This example uses a made-up demo product.
            </p>
          </div>
          <ProductPreview />
        </div>
      </section>

      {/* Why it matters */}
      <section aria-labelledby="why-heading" className="border-y bg-surface">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
          <h2 id="why-heading" className="font-display text-2xl font-semibold tracking-tight">
            Why it matters
          </h2>
          <dl className="mt-6 grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-2 lg:grid-cols-4">
            <Stat value="63M" label="Americans care for someone else" source="AARP, 2025" />
            <Stat value="1 in 5" label="caregivers has any training in managing their medicines" source="AARP, 2025" />
            <Stat value="6" label="fixed, rule-based checks run on every confirmed medicine" />
            <Stat value="4" label="ways to add a medicine: barcode, photo, words or the medicine list" />
          </dl>
          <p className="mt-4 text-sm text-muted-foreground">
            Caregivers have it hardest. MedCheck is built for the moment a second bottle comes into the house.
          </p>
        </div>
      </section>

      {/* About the checks: the six rules, the principle, and where label data comes from. */}
      <section aria-labelledby="checks-heading" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <SectionIntro
          id="checks-heading"
          title="About the checks"
          body="Six fixed rules give the same answer every time. Only details you confirmed are checked. If a detail is unknown, the check says what it still needs — it never guesses."
        />
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(Object.keys(CHECK_TITLES) as CheckId[]).map((id) => (
            <li key={id} className="rounded-2xl border bg-card p-5">
              <h3 className="font-semibold">{CHECK_TITLES[id]}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">{CHECK_DESCRIPTIONS[id]}</p>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-sm text-muted-foreground">
          Label details for real products come from FDA labels via openFDA. The demo products are made up.
        </p>

        <div className="mt-16 grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
          <div>
            <h3 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Evidence, not advice.</h3>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground text-pretty">
              MedCheck organizes what the labels and documents already say, so the conversation with your pharmacist
              starts from facts. The decision stays with a person who can answer it.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border bg-card p-6">
              <h4 className="flex items-center gap-2 text-sm font-semibold">
                <CheckIcon aria-hidden className="size-4 text-primary" />
                MedCheck does
              </h4>
              <ul className="mt-4 space-y-3 text-sm leading-relaxed">
                {DOES.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-dashed bg-surface p-6">
              <h4 className="flex items-center gap-2 text-sm font-semibold">
                <XIcon aria-hidden className="size-4 text-muted-foreground" />
                MedCheck never
              </h4>
              <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
                {NEVER.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Closing call to action */}
      {user ? null : (
        <section className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6 sm:pb-24">
          <div className="relative isolate overflow-hidden rounded-3xl bg-ink px-6 py-12 text-ink-foreground shadow-xl sm:px-12 sm:py-16">
            <div aria-hidden className="absolute inset-0 -z-10 bg-grid opacity-40 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
            <div aria-hidden className="absolute -right-24 -bottom-32 -z-10 size-[28rem] rounded-full bg-brand/30 blur-3xl" />
            <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
              <div>
                <h2 className="font-display text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                  See it work in under a minute.
                </h2>
                <p className="mt-3 max-w-xl text-ink-foreground/70 text-pretty">
                  The demo uses made-up information and resets any time. No account, nothing to install.
                </p>
              </div>
              <form action={startDemo}>
                <SubmitButton
                  size="lg"
                  className="h-12 w-full bg-ink-foreground px-6 text-base text-ink hover:bg-ink-foreground/90 lg:w-auto"
                  pendingLabel="Setting up the demo…"
                >
                  Try the demo <ArrowRightIcon aria-hidden />
                </SubmitButton>
              </form>
            </div>
          </div>
        </section>
      )}
    </AppShell>
  );
}

function SectionIntro({ id, title, body }: { id: string; title: string; body: string }) {
  return (
    <div className="max-w-2xl">
      <h2 id={id} className="scroll-mt-24 font-display text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        {title}
      </h2>
      <p className="mt-4 text-lg leading-relaxed text-muted-foreground text-pretty">{body}</p>
    </div>
  );
}

function Stat({ value, label, source }: { value: string; label: string; source?: string }) {
  return (
    <div className="flex flex-col gap-1 bg-card p-6">
      <dt className="order-2 text-sm leading-snug text-muted-foreground">
        {label}
        {source ? <span className="mt-1 block text-xs text-muted-foreground/80">{source}</span> : null}
      </dt>
      <dd className="order-1 font-display text-4xl font-semibold tracking-tight nums">{value}</dd>
    </div>
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
