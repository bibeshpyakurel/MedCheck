import { CameraIcon, ChevronRightIcon, ListIcon, MicIcon, ScanBarcodeIcon, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AppShell } from "@/components/app-shell";
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
      <div className="mx-auto max-w-xl space-y-6">
        <div className="space-y-2">
          <Link href={`/patients/${patientId}`} className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            ← {patient.displayName}
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Add a medicine</h1>
          <p className="text-muted-foreground">Choose the easiest way. You&apos;ll check every value before it&apos;s saved.</p>
        </div>
        <ul className="space-y-3">
          {options.map(({ href, icon: Icon, title, detail }) => (
            <li key={href}>
              <Link
                href={href}
                className="flex min-h-20 items-center gap-4 rounded-2xl border bg-card p-4 transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Icon aria-hidden className="size-6" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-lg font-medium">{title}</span>
                  <span className="block text-sm text-muted-foreground">{detail}</span>
                </span>
                <ChevronRightIcon aria-hidden className="size-5 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </AppShell>
  );
}
