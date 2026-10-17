import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth";
import { getPatient } from "@/lib/records";
import { DescribeForm } from "./describe-form";

export const metadata: Metadata = { title: "Describe a medicine" };

export default async function DescribePage({ params }: PageProps<"/patients/[patientId]/add/describe">) {
  await requireUser();
  const { patientId } = await params;
  if (!z.guid().safeParse(patientId).success) notFound();
  const patient = await getPatient(patientId);
  if (!patient) notFound();

  return (
    <AppShell>
      <div className="mx-auto max-w-xl space-y-8">
        <PageHeader
          back={{ href: `/patients/${patientId}/add`, label: "Add a medicine" }}
          eyebrow={`For ${patient.displayName}`}
          title="Describe it"
          description={<>Say or type what&apos;s on the label. You&apos;ll check each value next.</>}
        />
        <DescribeForm patientId={patientId} />
      </div>
    </AppShell>
  );
}
