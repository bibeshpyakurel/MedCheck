import { ChevronRightIcon, PlusIcon, RotateCcwIcon, UserRoundIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { startDemo } from "@/app/actions/session";
import { AppShell } from "@/components/app-shell";
import { DemoBadge } from "@/components/records/demo-badge";
import { ResetDemoButton } from "@/components/records/reset-demo-button";
import { SubmitButton } from "@/components/records/submit-button";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { personDetails, personLabel } from "@/lib/record-format";
import { getCaregiver, listPatients } from "@/lib/records";

export const metadata: Metadata = { title: "People" };

export default async function PatientsPage() {
  await requireUser();
  const [caregiver, patients] = await Promise.all([getCaregiver(), listPatients()]);
  if (!caregiver?.displayName && patients.length === 0) redirect("/welcome");
  const hasDemo = patients.some((p) => p.isDemo);

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            {caregiver?.displayName ? (
              <p className="text-sm text-muted-foreground">Signed in as {caregiver.displayName}</p>
            ) : null}
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Whose medicines?</h1>
          </div>
          <Button size="lg" className="h-11 px-4" nativeButton={false} render={<Link href="/patients/new" />}>
            <PlusIcon aria-hidden /> Add a person
          </Button>
        </div>

        {patients.length === 0 ? (
          <div className="mt-8 rounded-xl border border-dashed p-8 text-center">
            <UserRoundIcon aria-hidden className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 font-medium">No one here yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add yourself, or someone you care for — a child, a parent, a partner.
            </p>
          </div>
        ) : (
          <ul className="mt-6 divide-y overflow-hidden rounded-xl border bg-card">
            {patients.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/patients/${p.id}`}
                  className="flex min-h-16 items-center gap-4 px-4 py-3 transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                >
                  <span
                    aria-hidden
                    className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary font-semibold text-secondary-foreground"
                  >
                    {p.displayName.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{personLabel(p)}</span>
                      {p.isDemo ? <DemoBadge /> : null}
                    </span>
                    {personDetails(p) ? (
                      <span className="mt-0.5 block truncate text-sm text-muted-foreground">{personDetails(p)}</span>
                    ) : null}
                  </span>
                  <ChevronRightIcon aria-hidden className="size-5 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-8 rounded-xl bg-muted/60 p-4 text-sm">
          {hasDemo ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-muted-foreground">Changed the demo household? Put it back the way it started.</p>
              <ResetDemoButton className="h-11 px-4">
                <RotateCcwIcon aria-hidden /> Reset demo household
              </ResetDemoButton>
            </div>
          ) : (
            <form action={startDemo} className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-muted-foreground">Want to look around first? Add a synthetic demo household.</p>
              <SubmitButton variant="outline" className="h-11 px-4" pendingLabel="Adding…">
                Add demo household
              </SubmitButton>
            </form>
          )}
        </div>
      </div>
    </AppShell>
  );
}
