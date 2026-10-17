import { ArrowRightIcon, FlaskConicalIcon, PlusIcon, RotateCcwIcon, UserRoundIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resetDemo, startDemo } from "@/app/actions/session";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { DemoBadge } from "@/components/records/demo-badge";
import { PersonAvatar } from "@/components/records/person-avatar";
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
      <div className="mx-auto max-w-4xl">
        <PageHeader
          eyebrow={caregiver?.displayName ? `Signed in as ${caregiver.displayName}` : undefined}
          title="Whose medicines?"
          description="Each person has their own record: medicines, the checks MedCheck runs on them, and a pharmacist report."
          actions={
            <Button size="lg" className="h-11 px-4" nativeButton={false} render={<Link href="/patients/new" />}>
              <PlusIcon aria-hidden /> Add a person
            </Button>
          }
        />

        {patients.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed bg-card/50 px-6 py-14 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-xl bg-muted text-muted-foreground ring-1 ring-border">
              <UserRoundIcon aria-hidden className="size-6" />
            </span>
            <p className="mt-4 font-semibold">No one here yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Add yourself, or someone you care for — a child, a parent, a partner.
            </p>
          </div>
        ) : (
          <ul className="mt-10 grid gap-4 sm:grid-cols-2">
            {patients.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/patients/${p.id}`}
                  className="group flex h-full min-h-24 items-center gap-4 rounded-2xl border bg-card p-5 shadow-xs transition-[border-color,box-shadow] hover:border-input hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <PersonAvatar name={p.displayName} className="size-12 text-lg" />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-semibold">{personLabel(p)}</span>
                      {p.isDemo ? <DemoBadge /> : null}
                    </span>
                    <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                      {personDetails(p) || "Medicines, checks and report"}
                    </span>
                  </span>
                  <ArrowRightIcon
                    aria-hidden
                    className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-10 flex flex-col gap-4 rounded-2xl border bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-card text-muted-foreground ring-1 ring-border">
              <FlaskConicalIcon aria-hidden className="size-4" />
            </span>
            <p className="text-sm text-muted-foreground">
              {hasDemo
                ? "Changed the demo household? Put it back the way it started."
                : "Want to look around first? Add a synthetic demo household."}
            </p>
          </div>
          {hasDemo ? (
            <form action={resetDemo}>
              <SubmitButton variant="outline" className="h-11 w-full px-4 sm:w-auto" pendingLabel="Resetting…">
                <RotateCcwIcon aria-hidden /> Reset demo household
              </SubmitButton>
            </form>
          ) : (
            <form action={startDemo}>
              <SubmitButton variant="outline" className="h-11 w-full px-4 sm:w-auto" pendingLabel="Adding…">
                Add demo household
              </SubmitButton>
            </form>
          )}
        </div>
      </div>
    </AppShell>
  );
}
