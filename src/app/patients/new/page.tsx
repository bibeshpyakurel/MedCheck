import type { Metadata } from "next";
import Link from "next/link";
import { addPatient } from "@/app/actions/patients";
import { AppShell } from "@/components/app-shell";
import { SubmitButton } from "@/components/records/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Add a person" };

export default async function NewPatientPage({ searchParams }: PageProps<"/patients/new">) {
  await requireUser();
  const { error } = await searchParams;

  return (
    <AppShell>
      <div className="mx-auto max-w-md">
        <h1 className="text-2xl font-semibold tracking-tight">Add a person</h1>
        <p className="mt-2 text-muted-foreground text-pretty">
          Add yourself or someone you care for. Each person gets their own record: their medicines, the checks MedCheck
          runs on them, and a report for their pharmacist.
        </p>

        <form action={addPatient} className="mt-8 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="displayName">Name</Label>
            <Input
              id="displayName"
              name="displayName"
              required
              maxLength={120}
              autoFocus
              placeholder="e.g. Sam"
              aria-invalid={error === "name" || undefined}
              aria-describedby={error === "name" ? "name-error" : undefined}
              className="h-11 text-base"
            />
            {error === "name" ? (
              <p id="name-error" className="text-sm text-destructive">
                Please enter a name.
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="relationship">
              Relationship to you <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="relationship"
              name="relationship"
              maxLength={120}
              placeholder="e.g. self, son, mother"
              className="h-11 text-base"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">
              Note <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input id="notes" name="notes" maxLength={500} placeholder="e.g. age 13" className="h-11 text-base" />
            <p className="text-sm text-muted-foreground">
              For your reference and the pharmacist report. MedCheck never uses it to work out a dose.
            </p>
          </div>
          <p className="rounded-lg bg-muted px-3 py-2.5 text-sm text-muted-foreground">
            This is a demo — please use made-up names and details.
          </p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="ghost" className="h-12 sm:h-11" nativeButton={false} render={<Link href="/patients" />}>
              Cancel
            </Button>
            <SubmitButton size="lg" className="h-12 text-base sm:h-11 sm:px-5" pendingLabel="Adding…">
              Add person
            </SubmitButton>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
