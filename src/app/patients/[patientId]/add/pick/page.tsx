import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { FormulationSummary } from "@/components/catalog/formulation-summary";
import { PageHeader, SectionHeading } from "@/components/page-header";
import { RecordHeader } from "@/components/records/record-header";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { listFormulations } from "@/lib/catalog";
import type { Formulation } from "@/lib/domain/schema";
import { getPatient } from "@/lib/records";
import { isUuid } from "@/lib/uuid";
import { addFromCatalog } from "../catalog-actions";

export const metadata: Metadata = { title: "Choose from the medicine list" };

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
      <RecordHeader patient={patient} current="medicines" />
      <div className="mx-auto max-w-3xl space-y-10">
        <PageHeader
          back={{ href: `/patients/${patient.id}/add`, label: "Other ways to add" }}
          title="Choose from the medicine list"
          description={<>These are the products MedCheck already knows. You&apos;ll check every detail against your box on the next screen.</>}
        />

        {groups.map(
          (group, index) =>
            group.items.length > 0 && (
              <section key={group.title} className="space-y-4" aria-labelledby={`group-${index}`}>
                <SectionHeading
                  id={`group-${index}`}
                  title={
                    <>
                      {group.title}{" "}
                      <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-border nums">
                        {group.items.length}
                      </span>
                    </>
                  }
                  description={group.note}
                />
                <ul className="overflow-hidden rounded-2xl border bg-card shadow-xs divide-y">
                  {group.items.map((f) => (
                    <li key={f.id} className="flex flex-col gap-4 p-5 transition-colors hover:bg-muted/30 sm:flex-row sm:items-start sm:justify-between">
                      <FormulationSummary formulation={f} headingLevel="h3" />
                      <form action={addFromCatalog} className="shrink-0">
                        <input type="hidden" name="patientId" value={patient.id} />
                        <input type="hidden" name="formulationId" value={f.id} />
                        <input type="hidden" name="method" value="picker" />
                        <Button type="submit" variant="outline" className="h-11 w-full px-4 sm:w-auto">
                          Add this medicine
                        </Button>
                      </form>
                    </li>
                  ))}
                </ul>
              </section>
            ),
        )}

        {formulations.length === 0 && <p className="text-muted-foreground">The medicine list is empty right now.</p>}
      </div>
    </AppShell>
  );
}
