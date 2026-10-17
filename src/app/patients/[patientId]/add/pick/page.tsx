import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { FormulationSummary } from "@/components/catalog/formulation-summary";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { listFormulations } from "@/lib/catalog";
import type { Formulation } from "@/lib/domain/schema";
import { getPatient } from "@/lib/records";
import { isUuid } from "@/lib/uuid";
import { addFromCatalog } from "../catalog-actions";

export const metadata: Metadata = { title: "Pick from the list" };

export default async function PickPage({ params }: PageProps<"/patients/[patientId]/add/pick">) {
  await requireUser();
  const { patientId } = await params;
  const [patient, formulations] = await Promise.all([
    isUuid(patientId) ? getPatient(patientId) : null,
    listFormulations(),
  ]);
  if (!patient) notFound();

  const groups: { title: string; note: string; items: Formulation[] }[] = [
    {
      title: "Demo products",
      note: "Invented for this demo. They match the printable demo labels.",
      items: formulations.filter((f) => f.isFictional),
    },
    {
      title: "Real products",
      note: "From FDA labels on openFDA. Store brands with the same ingredients, strength and form are grouped.",
      items: formulations.filter((f) => !f.isFictional),
    },
  ];

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-8">
        <div>
          <Link
            href={`/patients/${patient.id}/add`}
            className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            ← Other ways to add
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Pick from the supported list</h1>
          <p className="mt-1 text-muted-foreground">
            For {patient.displayName}. You&apos;ll check every value against your box on the next screen.
          </p>
        </div>

        {groups.map(
          (group, index) =>
            group.items.length > 0 && (
              <section key={group.title} className="space-y-3" aria-labelledby={`group-${index}`}>
                <div>
                  <h2 id={`group-${index}`} className="text-lg font-semibold">
                    {group.title}
                  </h2>
                  <p className="text-sm text-muted-foreground">{group.note}</p>
                </div>
                <ul className="space-y-3">
                  {group.items.map((f) => (
                    <li key={f.id} className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-start sm:justify-between">
                      <FormulationSummary formulation={f} headingLevel="h3" />
                      <form action={addFromCatalog} className="shrink-0">
                        <input type="hidden" name="patientId" value={patient.id} />
                        <input type="hidden" name="formulationId" value={f.id} />
                        <input type="hidden" name="method" value="picker" />
                        <Button type="submit" className="h-11 w-full px-4 text-base sm:w-auto">
                          Add this medicine
                        </Button>
                      </form>
                    </li>
                  ))}
                </ul>
              </section>
            ),
        )}

        {formulations.length === 0 && <p className="text-muted-foreground">The supported list is empty right now.</p>}
      </div>
    </AppShell>
  );
}
