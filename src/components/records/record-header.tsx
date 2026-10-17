import "server-only";

import { ClipboardCheckIcon, ListChecksIcon, PillIcon, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { PatientSwitcher } from "@/components/records/patient-switcher";
import { PersonAvatar } from "@/components/records/person-avatar";
import { personLabel } from "@/lib/record-format";
import { listPatients, type Patient } from "@/lib/records";
import { cn } from "@/lib/utils";

export type RecordSection = "medicines" | "checks" | "report";

const SECTIONS: { id: RecordSection; label: string; icon: LucideIcon; href: (base: string) => string }[] = [
  { id: "medicines", label: "Medicines", icon: PillIcon, href: (base) => base },
  { id: "checks", label: "Checks", icon: ListChecksIcon, href: (base) => `${base}/checks` },
  { id: "report", label: "Report", icon: ClipboardCheckIcon, href: (base) => `${base}/export` },
];

/**
 * The top of every record screen, in the same place each time: whose record this is, Change person,
 * and Medicines / Checks / Report. `current` is the section this screen belongs to (adding or
 * reviewing a medicine is part of Medicines).
 */
export async function RecordHeader({ patient, current }: { patient: Patient; current: RecordSection }) {
  const patients = await listPatients();
  const base = `/patients/${patient.id}`;
  return (
    <div className="mb-8 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <PersonAvatar name={patient.displayName} />
          <p className="min-w-0 truncate font-semibold">{personLabel(patient)}</p>
        </div>
        <PatientSwitcher
          currentId={patient.id}
          patients={patients.map((p) => ({ id: p.id, label: personLabel(p), isDemo: p.isDemo }))}
        />
      </div>
      <nav aria-label={`${personLabel(patient)}: record sections`}>
        <ul className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1 ring-1 ring-border/60 ring-inset sm:inline-grid sm:min-w-[26rem]">
          {SECTIONS.map(({ id, label, icon: Icon, href }) => {
            const active = id === current;
            return (
              <li key={id}>
                <Link
                  href={href(base)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                    active ? "bg-card text-foreground shadow-xs ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon aria-hidden className="size-4" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
