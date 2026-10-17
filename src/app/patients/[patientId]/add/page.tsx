import { ArrowRightIcon, CameraIcon, ListIcon, MicIcon, ScanBarcodeIcon, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth";
import { getPatient } from "@/lib/records";

export const metadata: Metadata = { title: "Add a medicine" };

export default async function AddPage({ params }: PageProps<"/patients/[patientId]/add">) {
  await requireUser();
  const { patientId } = await params;
  if (!z.guid().safeParse(patientId).success) notFound();
  const patient = await getPatient(patientId);
  if (!patient) notFound();

  const base = `/patients/${patientId}/add`;
  const options: { href: string; icon: LucideIcon; title: string; detail: string }[] = [
    {
      href: `${base}/scan`,
      icon: ScanBarcodeIcon,
      title: "Scan barcode",
      detail: "Over-the-counter box or bottle — looks up the FDA label",
    },
    {
      href: `${base}/photo`,
      icon: CameraIcon,
      title: "Photo of label or document",
      detail: "Prescription label, discharge list, or a package's Drug Facts",
    },
    { href: `${base}/describe`, icon: MicIcon, title: "Describe it", detail: "Say or type what the label says" },
    { href: `${base}/pick`, icon: ListIcon, title: "Pick from supported list", detail: "Choose a product we already know" },
  ];

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-8">
        <PageHeader
          back={{ href: `/patients/${patientId}`, label: patient.displayName }}
          eyebrow={`For ${patient.displayName}`}
          title="Add a medicine"
          description={<>Choose the easiest way. You&apos;ll check every value before it&apos;s saved.</>}
        />
        <ul className="grid gap-4 sm:grid-cols-2">
          {options.map(({ href, icon: Icon, title, detail }) => (
            <li key={href}>
              <Link
                href={href}
                className="group flex h-full min-h-20 items-center gap-4 rounded-2xl border bg-card p-5 shadow-xs transition-[border-color,box-shadow] hover:border-primary/40 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:flex-col sm:items-start sm:gap-5 sm:p-6"
              >
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground ring-1 ring-primary/15 transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon aria-hidden className="size-6" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-base font-semibold sm:text-lg">
                    {title}
                    <ArrowRightIcon
                      aria-hidden
                      className="hidden size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary sm:block"
                    />
                  </span>
                  <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{detail}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </AppShell>
  );
}
