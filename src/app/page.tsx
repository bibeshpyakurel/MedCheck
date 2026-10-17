import {
  ArrowRightIcon,
  BadgeCheckIcon,
  CheckIcon,
  ClipboardListIcon,
  CopyIcon,
  FileSearchIcon,
  LinkIcon,
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
    body: "Scan the barcode, photograph the label or discharge list, or just describe it in your own words.",
  },
  {
    icon: ClipboardListIcon,
    title: "Confirm what it read",
    body: "Every value sits next to the part of the label it came from. Nothing counts until you say it matches.",
  },
  {
    icon: MessageCircleQuestionIcon,
    title: "Bring questions to a pharmacist",
    body: "Fixed rules compare what you confirmed and turn anything worth asking about into a ready-to-ask question.",
  },
];

/** What each of the six fixed rules looks for (see docs/superpowers/specs, §6). */
const CHECK_DESCRIPTIONS: Record<CheckId, string> = {
  ingredient_overlap: "Two different products list the same active ingredient — named with the label's own warning.",
  repeated_record: "The same product entered twice is reported as a repeat, not as an overlap.",
  concentration: "Two liquids with the same ingredient but different strengths, each stated exactly as printed.",
  units: "Directions and strength that use units which don't line up, like mL against teaspoons.",
  document_vs_bottle: "A discharge list, prescription and bottle that disagree on strength or directions.",
  database_vs_box: "For scanned products, the FDA label on file against the Drug Facts on the box in your hand.",
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

const TRUST = [
  { icon: BadgeCheckIcon, text: "Nothing counts until you confirm it" },
  { icon: LinkIcon, text: "Every finding links to label text" },
  { icon: FileSearchIcon, text: "FDA label data via openFDA" },
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
      {/* Hero */}
      <section className="relative isolate overflow-hidden border-b">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-grid [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]"
        />
        <div
          aria-hidden
          className="absolute -top-48 left-1/2 -z-10 h-[34rem] w-[60rem] -translate-x-1/2 rounded-full bg-brand/14 blur-3xl"
        />
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pt-12 pb-16 sm:px-6 sm:pt-20 sm:pb-24 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)] lg:gap-16">
          <div className="animate-fade-up">
            <p className="inline-flex items-center gap-2 rounded-2xl border bg-card/80 px-3 py-1 text-xs font-medium text-muted-foreground shadow-xs backdrop-blur sm:rounded-full sm:text-sm">
              <span className="size-1.5 rounded-full bg-brand" aria-hidden />
              For anyone managing medicines — yours or someone else&apos;s
            </p>
            <h1 className="mt-6 font-display text-[2.5rem] leading-[1.04] font-semibold tracking-[-0.035em] text-balance sm:text-5xl lg:text-[3.6rem]">
              Catch shared ingredients and mismatched strengths{" "}
              <span className="bg-gradient-to-r from-primary to-brand bg-clip-text text-transparent">
                before they reach the spoon.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground text-pretty">
              Scan a barcode, photograph a label, or just describe the medicine. You confirm what MedCheck reads, fixed
              rules do the checking, and every finding links to the label text behind it — ready to bring to a pharmacist.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
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
                  <form action={startDemo}>
                    <SubmitButton size="lg" className="h-12 w-full px-6 text-base" pendingLabel="Setting up the demo…">
                      Try the demo household <ArrowRightIcon aria-hidden />
                    </SubmitButton>
                  </form>
                  <form action={startOwn}>
                    <SubmitButton variant="outline" size="lg" className="h-12 w-full px-6 text-base" pendingLabel="Starting…">
                      Start my own
                    </SubmitButton>
                  </form>
                </>
              )}
            </div>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">
              No account needed. In the demo household, Alex keeps track of their own medicines and their son Sam&apos;s
              (13), with one product each already on file.
            </p>

            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-3 border-t pt-6 text-sm text-muted-foreground">
              {TRUST.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-2">
                  <Icon aria-hidden className="size-4 text-primary" />
                  {text}
                </li>
              ))}
            </ul>
          </div>

          <ProductPreview />
        </div>
      </section>

      {/* Why it matters */}
      <section aria-labelledby="why-heading" className="border-b bg-surface">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
          <h2 id="why-heading" className="sr-only">
            Why it matters
          </h2>
          <dl className="grid gap-px overflow-hidden rounded-2xl border bg-border shadow-xs sm:grid-cols-2 lg:grid-cols-4">
            <Stat value="63M" label="Americans care for someone else" source="AARP, 2025" />
            <Stat value="1 in 5" label="caregivers has any training in managing their medicines" source="AARP, 2025" />
            <Stat value="6" label="fixed, rule-based checks run on every confirmed medicine" />
            <Stat value="4" label="ways to add a medicine: barcode, photo, description or list" />
          </dl>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Caregivers have it hardest. MedCheck is built for the moment a second bottle comes into the house.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section aria-labelledby="how-heading" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <SectionIntro
          id="how-heading"
          eyebrow="How it works"
          title="From the bottle in your hand to a clear question."
          body="Three steps, every one of them visible. MedCheck reads; you confirm; fixed rules compare."
        />
        <ol className="relative mt-12 grid gap-4 md:grid-cols-3 md:gap-6">
          <div aria-hidden className="absolute top-7 right-[16%] left-[16%] hidden h-px bg-gradient-to-r from-transparent via-border to-transparent md:block" />
          {STEPS.map((step, i) => (
            <li key={step.title} className="relative rounded-2xl border bg-card p-6 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="grid size-12 place-items-center rounded-xl bg-accent text-accent-foreground ring-1 ring-primary/10">
                  <step.icon aria-hidden className="size-5" />
                </span>
                <span className="font-mono text-xs font-medium text-muted-foreground">Step {String(i + 1).padStart(2, "0")}</span>
              </div>
              <h3 className="mt-6 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* The six checks */}
      <section aria-labelledby="checks-heading" className="border-y bg-surface">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <SectionIntro
            id="checks-heading"
            eyebrow="The checks"
            title="Six fixed rules. The same answer every time."
            body="Only values you confirmed are checked. If a value is unreadable, the check says it couldn't be completed — it never guesses."
          />
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(Object.keys(CHECK_TITLES) as CheckId[]).map((id, i) => (
              <li key={id} className="group rounded-2xl border bg-card p-5 shadow-xs transition-shadow hover:shadow-md">
                <div className="flex items-center gap-3">
                  <span className="grid size-8 place-items-center rounded-lg bg-muted font-mono text-xs font-semibold text-muted-foreground ring-1 ring-border">
                    {i + 1}
                  </span>
                  <h3 className="font-semibold">{CHECK_TITLES[id]}</h3>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground text-pretty">{CHECK_DESCRIPTIONS[id]}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Principle */}
      <section aria-labelledby="principle-heading" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
          <div>
            <p className="text-sm font-semibold text-primary">Our principle</p>
            <h2 id="principle-heading" className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Evidence, not advice.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground text-pretty">
              MedCheck organizes what the labels and documents already say, so the conversation with your pharmacist
              starts from facts. The decision stays with a person who can answer it.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border bg-card p-6 shadow-xs">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <span className="grid size-6 place-items-center rounded-full bg-accent text-accent-foreground">
                  <CheckIcon aria-hidden className="size-3.5" />
                </span>
                MedCheck does
              </h3>
              <ul className="mt-5 space-y-3.5">
                {DOES.map((d) => (
                  <li key={d} className="flex gap-3 text-sm leading-relaxed">
                    <CheckIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
                    {d}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-dashed bg-surface p-6">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <span className="grid size-6 place-items-center rounded-full bg-muted text-muted-foreground ring-1 ring-border">
                  <XIcon aria-hidden className="size-3.5" />
                </span>
                MedCheck never
              </h3>
              <ul className="mt-5 space-y-3.5">
                {NEVER.map((d) => (
                  <li key={d} className="flex gap-3 text-sm leading-relaxed text-muted-foreground">
                    <XIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
                    {d}
                  </li>
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
                  See it work on a real household in under a minute.
                </h2>
                <p className="mt-3 max-w-xl text-ink-foreground/70 text-pretty">
                  The demo household is synthetic and resets any time. No account, nothing to install.
                </p>
              </div>
              <form action={startDemo}>
                <SubmitButton
                  size="lg"
                  className="h-12 w-full bg-ink-foreground px-6 text-base text-ink hover:bg-ink-foreground/90 lg:w-auto"
                  pendingLabel="Setting up the demo…"
                >
                  Open the demo household <ArrowRightIcon aria-hidden />
                </SubmitButton>
              </form>
            </div>
          </div>
        </section>
      )}
    </AppShell>
  );
}

function SectionIntro({ id, eyebrow, title, body }: { id: string; eyebrow: string; title: string; body: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-sm font-semibold text-primary">{eyebrow}</p>
      <h2 id={id} className="mt-3 font-display text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
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

/** A static illustration of what a finding looks like, framed as the app. Uses the fictional demo product. */
function ProductPreview() {
  return (
    <div className="relative animate-fade-up [animation-delay:120ms]">
      <div aria-hidden className="absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-br from-brand/20 via-transparent to-finding/15 blur-2xl" />
      <figure
        aria-label="Example of a MedCheck finding"
        className="overflow-hidden rounded-2xl border bg-card shadow-xl ring-1 ring-foreground/5"
      >
        <div className="flex items-center gap-2 border-b bg-surface px-4 py-3">
          <span aria-hidden className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-foreground/15" />
            <span className="size-2.5 rounded-full bg-foreground/15" />
            <span className="size-2.5 rounded-full bg-foreground/15" />
          </span>
          <span className="ml-2 text-xs font-medium text-muted-foreground">Example finding · Checks run</span>
        </div>

        <div className="space-y-4 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-finding-surface px-2.5 py-1 text-xs font-semibold text-finding-foreground ring-1 ring-finding/30">
              <span className="size-1.5 rounded-full bg-finding" aria-hidden />
              Found something
            </span>
            <span className="text-xs text-muted-foreground">Shared active ingredients</span>
          </div>
          <p className="font-display text-lg leading-snug font-semibold text-balance">
            Two medicines share an active ingredient: acetaminophen
          </p>
          <ul className="divide-y overflow-hidden rounded-xl border text-sm">
            <li className="flex items-baseline justify-between gap-3 px-3.5 py-2.5">
              <span className="font-medium">Calmora Fever Relief (Bottle A)</span>
              <span className="shrink-0 text-muted-foreground nums">100 mg per 5 mL</span>
            </li>
            <li className="flex items-baseline justify-between gap-3 px-3.5 py-2.5">
              <span className="font-medium">Nighttime cold &amp; flu caplets</span>
              <span className="shrink-0 text-muted-foreground nums">325 mg per caplet</span>
            </li>
          </ul>
          <blockquote className="border-l-2 border-finding pl-3 text-sm text-muted-foreground italic">
            &ldquo;Do not use with any other drug containing acetaminophen.&rdquo;
            <span className="mt-1 block text-xs not-italic">— from the Bottle A label</span>
          </blockquote>
          <figcaption className="rounded-xl bg-finding-surface p-4 text-sm text-finding-foreground ring-1 ring-finding/25">
            <span className="block text-xs font-semibold tracking-wide uppercase">Ask your pharmacist</span>
            <span className="mt-1.5 block font-medium text-foreground">
              Both of these contain acetaminophen. Can they be given together, and how should I keep track?
            </span>
            <span aria-hidden className="mt-3 inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground shadow-xs">
              <CopyIcon className="size-3.5" /> Copy question
            </span>
          </figcaption>
        </div>
      </figure>
    </div>
  );
}
