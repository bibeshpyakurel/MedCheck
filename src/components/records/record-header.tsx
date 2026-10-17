import { ClipboardListIcon, PillIcon, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { PersonAvatar } from "@/components/records/person-avatar";
import type { Patient } from "@/lib/records";
import { cn } from "@/lib/utils";

export type RecordSection = "medicines" | "report";

const SECTIONS: { id: RecordSection; label: string; icon: LucideIcon; href: (base: string) => string }[] = [
  { id: "medicines", label: "Medicines", icon: PillIcon, href: (base) => base },
  { id: "report", label: "Medicine report", icon: ClipboardListIcon, href: (base) => `${base}/export` },
];

/**
 * The top of every record screen: whose record it is, small, and the two tabs, Medicines and
 * Medicine report. `current` is the tab this screen belongs to (adding or reviewing a medicine is
 * part of Medicines).
 */
export function RecordHeader({ patient, current }: { patient: Patient; current: RecordSection }) {
  const base = `/patients/${patient.id}`;
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="flex min-w-0 items-center gap-2 text-sm font-medium text-muted-foreground">
        <PersonAvatar name={patient.displayName} className="size-7 text-xs" />
        <span className="truncate">{patient.displayName}</span>
      </p>
      <nav aria-label="Record">
        <ul className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1 ring-1 ring-border/60 ring-inset sm:min-w-[22rem]">
          {SECTIONS.map(({ id, label, icon: Icon, href }) => {
            const active = id === current;
            return (
              <li key={id}>
                <Link
                  href={href(base)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
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
