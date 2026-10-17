import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { RecordHeader } from "@/components/records/record-header";
import { requireUser } from "@/lib/auth";
import { getPatient } from "@/lib/records";
import { DescribeForm } from "./describe-form";

export const metadata: Metadata = { title: "Type or say what the label says" };

export default async function DescribePage({ params }: PageProps<"/patients/[patientId]/add/describe">) {
  await requireUser();
  const { patientId } = await params;
  if (!z.guid().safeParse(patientId).success) notFound();
  const patient = await getPatient(patientId);
  if (!patient) notFound();

  return (
    <AppShell>
      <RecordHeader patient={patient} current="medicines" />
      <div className="mx-auto max-w-xl space-y-8">
        <PageHeader
          back={{ href: `/patients/${patientId}/add`, label: "Other ways to add" }}
          title="Type or say what the label says"
          description={<>Use your own words. You&apos;ll check each detail next.</>}
        />
        <DescribeForm patientId={patientId} />
      </div>
    </AppShell>
  );
}
