import { ArrowRightIcon, CheckIcon, ClipboardListIcon, MessageCircleQuestionIcon, ScanLineIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { startDemo, startOwn } from "@/app/actions/session";
import { AppShell } from "@/components/app-shell";
import { SubmitButton } from "@/components/records/submit-button";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";

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
      actions={
        user ? (
          <Button variant="ghost" className="h-11" nativeButton={false} render={<Link href="/patients" />}>
            My records
          </Button>
        ) : null
      }
    >
      <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-14">
        <section>
          <p className="text-sm font-medium text-primary">For anyone managing medicines — yours or someone else&apos;s</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]">
            Catch shared ingredients and mismatched strengths before they reach the spoon.
          </h1>
          <p className="mt-4 text-lg text-muted-foreground text-pretty">
            Scan a barcode, photograph a label, or just describe the medicine. You confirm what MedCheck reads, fixed
            rules do the checking, and every finding links to the label text behind it — ready to bring to a pharmacist.
          </p>
          <p className="mt-4 border-l-2 border-primary/40 pl-3 text-sm text-muted-foreground text-pretty">
            Caregivers have it hardest: 63 million Americans care for someone else, and only about 1 in 5 has any
            training in managing their medicines. <span className="whitespace-nowrap">(AARP, 2025)</span>
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {user ? (
              <>
                <Button size="lg" className="h-12 px-5 text-base" nativeButton={false} render={<Link href="/patients" />}>
                  Go to my records <ArrowRightIcon aria-hidden />
                </Button>
                <form action={startDemo}>
                  <SubmitButton variant="outline" size="lg" className="h-12 w-full px-5 text-base" pendingLabel="Opening…">
                    Open the demo household
                  </SubmitButton>
                </form>
              </>
            ) : (
              <>
                <form action={startDemo}>
                  <SubmitButton size="lg" className="h-12 w-full px-5 text-base" pendingLabel="Setting up the demo…">
                    Try the demo household <ArrowRightIcon aria-hidden />
                  </SubmitButton>
                </form>
                <form action={startOwn}>
                  <SubmitButton variant="outline" size="lg" className="h-12 w-full px-5 text-base" pendingLabel="Starting…">
                    Start my own
                  </SubmitButton>
                </form>
              </>
            )}
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            No account needed. In the demo household, Alex keeps track of their own medicines and their son Sam&apos;s (13), with one product each already on file.
          </p>
        </section>

        <ExampleFinding />
      </div>

      <section aria-labelledby="how-heading" className="mt-16 sm:mt-20">
        <h2 id="how-heading" className="text-xl font-semibold tracking-tight">
          How it works
        </h2>
        <ol className="mt-5 grid gap-4 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="rounded-xl border bg-card p-5">
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-lg bg-secondary text-secondary-foreground">
                  <step.icon aria-hidden className="size-5" />
                </span>
                <span className="text-sm font-medium text-muted-foreground">Step {i + 1}</span>
              </div>
              <h3 className="mt-4 font-semibold">{step.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground text-pretty">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="principle-heading" className="mt-16 rounded-2xl border bg-card p-6 sm:mt-20 sm:p-8">
        <p className="text-sm font-medium text-primary">Our principle</p>
        <h2 id="principle-heading" className="mt-1 text-2xl font-semibold tracking-tight">
          Evidence, not advice.
        </h2>
        <p className="mt-2 max-w-2xl text-muted-foreground text-pretty">
          MedCheck organizes what the labels and documents already say, so the conversation with your pharmacist starts
          from facts. The decision stays with a person who can answer it.
        </p>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold">MedCheck does</h3>
            <ul className="mt-3 space-y-2.5">
              {DOES.map((d) => (
                <li key={d} className="flex gap-2.5 text-sm">
                  <CheckIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
                  {d}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold">MedCheck never</h3>
            <ul className="mt-3 space-y-2.5">
              {NEVER.map((d) => (
                <li key={d} className="flex gap-2.5 text-sm">
                  <XIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  {d}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </AppShell>
  );
}

/** A static illustration of what a finding looks like. Uses the fictional demo product. */
function ExampleFinding() {
  return (
    <figure aria-label="Example of a MedCheck finding" className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-full bg-finding" aria-hidden />
        <span className="text-xs font-semibold tracking-wide text-finding-foreground uppercase">Found something</span>
      </div>
      <p className="mt-3 font-semibold text-balance">Two medicines share an active ingredient: acetaminophen</p>
      <ul className="mt-4 space-y-2 text-sm">
        <li className="flex items-baseline justify-between gap-3 rounded-lg bg-muted px-3 py-2">
          <span>Calmora Fever Relief (Bottle A)</span>
          <span className="shrink-0 text-muted-foreground">100 mg per 5 mL</span>
        </li>
        <li className="flex items-baseline justify-between gap-3 rounded-lg bg-muted px-3 py-2">
          <span>Nighttime cold &amp; flu caplets</span>
          <span className="shrink-0 text-muted-foreground">325 mg per caplet</span>
        </li>
      </ul>
      <blockquote className="mt-4 border-l-2 border-finding pl-3 text-sm text-muted-foreground italic">
        &ldquo;Do not use with any other drug containing acetaminophen.&rdquo;
        <span className="mt-1 block text-xs not-italic">— from the Bottle A label</span>
      </blockquote>
      <figcaption className="mt-4 rounded-lg bg-finding-surface px-3 py-2.5 text-sm text-finding-foreground">
        <span className="font-medium">Ask your pharmacist:</span> Both of these contain acetaminophen. Can they be given
        together, and how should I keep track?
      </figcaption>
    </figure>
  );
}
