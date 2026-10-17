import type { Metadata } from "next";
import { saveCaregiverName } from "@/app/actions/session";
import { AppShell } from "@/components/app-shell";
import { SubmitButton } from "@/components/records/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireUser } from "@/lib/auth";
import { isSelf } from "@/lib/record-format";
import { getCaregiver, listPatients } from "@/lib/records";

export const metadata: Metadata = { title: "Welcome" };

const CHOICES = [
  { value: "self", title: "Myself", body: "Check the medicines you take." },
  { value: "others", title: "Someone I care for", body: "A child, a parent, a partner — anyone." },
  { value: "both", title: "Both", body: "Keep a record for you and for them." },
] as const;

export default async function WelcomePage({ searchParams }: PageProps<"/welcome">) {
  await requireUser();
  const [caregiver, patients, { error }] = await Promise.all([getCaregiver(), listPatients(), searchParams]);
  const hasSelf = patients.some(isSelf);
  const hasOthers = patients.some((p) => !isSelf(p) && !p.isDemo);
  const defaultChoice = hasSelf && hasOthers ? "both" : hasSelf ? "self" : "others";

  return (
    <AppShell>
      <div className="mx-auto max-w-md">
        <p className="text-sm font-medium text-primary">Welcome to MedCheck</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Let&apos;s get you set up</h1>
        <p className="mt-2 text-muted-foreground text-pretty">Two quick questions, then you can add a medicine.</p>

        <form action={saveCaregiverName} className="mt-8 space-y-8">
          <div className="space-y-2">
            <Label htmlFor="displayName" className="text-base">
              Your name
            </Label>
            <Input
              id="displayName"
              name="displayName"
              required
              maxLength={120}
              autoComplete="name"
              autoFocus
              defaultValue={caregiver?.displayName ?? ""}
              placeholder="e.g. Alex"
              aria-invalid={error === "name" || undefined}
              aria-describedby={error === "name" ? "name-error name-hint" : "name-hint"}
              className="h-11 text-base"
            />
            {error === "name" ? (
              <p id="name-error" className="text-sm text-destructive">
                Please enter a name.
              </p>
            ) : null}
            <p id="name-hint" className="text-sm text-muted-foreground">
              Goes on your pharmacist report, so they know who is asking. Please use a made-up name — this is a demo.
            </p>
          </div>

          <fieldset className="space-y-3">
            <legend className="text-base font-medium">Who are you checking medicines for?</legend>
            {CHOICES.map((c) => (
              <label
                key={c.value}
                className="flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border bg-card px-4 py-3 transition-colors hover:bg-muted has-checked:border-primary has-checked:bg-accent has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
              >
                <input
                  type="radio"
                  name="checkingFor"
                  value={c.value}
                  defaultChecked={c.value === defaultChoice}
                  required
                  className="size-5 shrink-0 accent-primary"
                />
                <span>
                  <span className="block font-medium">{c.title}</span>
                  <span className="block text-sm text-muted-foreground">{c.body}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <SubmitButton size="lg" className="h-12 w-full text-base" pendingLabel="Saving…">
            Continue
          </SubmitButton>
        </form>
      </div>
    </AppShell>
  );
}
