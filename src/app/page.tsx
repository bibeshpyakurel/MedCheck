import { AppShell } from "@/components/app-shell";

// M0 placeholder landing. Feature D replaces the call to action with
// "Try the demo household" / "Start my own" (anonymous sign-in).
export default function Home() {
  return (
    <AppShell>
      <section className="max-w-2xl">
        <p className="text-sm font-medium text-primary">For caregivers managing someone else&apos;s medicines</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Catch shared ingredients and mismatched strengths before they reach the spoon.
        </h1>
        <p className="mt-4 text-lg text-muted-foreground text-pretty">
          Scan a barcode, photograph a label, or just describe the medicine. You confirm what MedCheck reads, fixed rules
          do the checking, and every finding links to the label text behind it — ready to bring to a pharmacist.
        </p>
      </section>
    </AppShell>
  );
}
