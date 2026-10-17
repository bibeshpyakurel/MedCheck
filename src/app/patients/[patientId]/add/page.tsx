import { ArrowRightIcon, CameraIcon, ListIcon, MicIcon, ScanBarcodeIcon, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { RecordHeader } from "@/components/records/record-header";
import { requireUser } from "@/lib/auth";
import { recordTitle } from "@/lib/record-format";
import { getPatient } from "@/lib/records";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Add a medicine" };

const JOURNEY = ["Add medicine", "Check details", "See questions"];

export default async function AddPage({ params }: PageProps<"/patients/[patientId]/add">) {
  await requireUser();
  const { patientId } = await params;
  if (!z.guid().safeParse(patientId).success) notFound();
  const patient = await getPatient(patientId);
  if (!patient) notFound();

  const base = `/patients/${patientId}/add`;
  const options: { href: string; icon: LucideIcon; title: string; detail: string }[] = [
    { href: `${base}/scan`, icon: ScanBarcodeIcon, title: "Scan a barcode", detail: "Use the barcode on the box or bottle." },
    { href: `${base}/photo`, icon: CameraIcon, title: "Take or choose a photo", detail: "Use a label or medicine document." },
    {
      href: `${base}/describe`,
      icon: MicIcon,
      title: "Type or say what the label says",
      detail: "Enter the details in your own words.",
    },
    { href: `${base}/pick`, icon: ListIcon, title: "Choose from the medicine list", detail: "Find a product already in MedCheck." },
  ];

  return (
    <AppShell>
      <RecordHeader patient={patient} current="medicines" />
      <div className="mx-auto max-w-3xl space-y-8">
        <PageHeader
          back={{ href: `/patients/${patientId}`, label: recordTitle(patient) }}
          title="Add a medicine"
          description={<>Choose the easiest way. You&apos;ll check every detail before it&apos;s used.</>}
        />
        <ol aria-label="Steps" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          {JOURNEY.map((step, i) => (
            <li key={step} className="flex items-center gap-2">
              {i > 0 ? <ArrowRightIcon aria-hidden className="size-3.5 text-muted-foreground" /> : null}
              <span
                aria-current={i === 0 ? "step" : undefined}
                className={cn(i === 0 ? "font-semibold text-foreground" : "text-muted-foreground")}
              >
                {step}
              </span>
            </li>
          ))}
        </ol>
        <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4">
          {options.map(({ href, icon: Icon, title, detail }) => (
            <li key={href}>
              <Link
                href={href}
                className="group flex h-full min-h-20 items-center gap-4 rounded-2xl border bg-card p-5 transition-[border-color,box-shadow] hover:border-primary/40 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon aria-hidden className="size-6" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-semibold">{title}</span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">{detail}</span>
                </span>
                <ArrowRightIcon
                  aria-hidden
                  className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </AppShell>
  );
}
