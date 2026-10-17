import { ArrowRightIcon } from "lucide-react";
import { redirect } from "next/navigation";
import { startDemo, startOwn } from "@/app/actions/session";
import { AppShell } from "@/components/app-shell";
import { SubmitButton } from "@/components/records/submit-button";
import { getCurrentUser } from "@/lib/auth";
import { getCaregiver, listPatients } from "@/lib/records";

// Action first: visitors get one screen with the way in; the explainers live in the ☰ menu.
// Anyone who already has records goes straight to them, like opening an app they already use.
// A session that never got past setup still sees this page, so "Try the demo" stays one tap away.
export default async function Home() {
  if (await getCurrentUser()) {
    const [caregiver, patients] = await Promise.all([getCaregiver(), listPatients()]);
    if (caregiver?.displayName || patients.length > 0) redirect("/patients");
  }

  return (
    <AppShell bleed>
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
          </div>

          <p className="mt-6 max-w-xl border-l-2 border-primary pl-3 text-sm leading-relaxed text-pretty sm:text-base">
            <strong className="font-semibold">MedCheck compares what labels say.</strong> It doesn&apos;t choose a medicine or
            an amount.
          </p>
        </div>
      </section>
    </AppShell>
  );
}
