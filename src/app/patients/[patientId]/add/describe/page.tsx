import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AppShell } from "@/components/app-shell";
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
      <div className="mx-auto max-w-xl space-y-6">
        <div className="space-y-2">
          <Link href={`/patients/${patientId}/add`} className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            ← Add a medicine
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Describe it</h1>
          <p className="text-muted-foreground">
            For {patient.displayName}. Say or type what&apos;s on the label. You&apos;ll check each value next.
          </p>
        </div>
        <DescribeForm patientId={patientId} />
      </div>
    </AppShell>
  );
}
