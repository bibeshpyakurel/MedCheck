"use client";

import { ClipboardListIcon, PillIcon, PlusIcon, type LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { spring } from "@/lib/motion";
import { recordNav, type RecordTab } from "@/lib/record-nav";
import { cn } from "@/lib/utils";

const TABS: { id: RecordTab; label: string; name: string; icon: LucideIcon; href: (base: string) => string }[] = [
  { id: "medicines", label: "Medicines", name: "Medicines", icon: PillIcon, href: (base) => base },
  { id: "report", label: "Report", name: "Medicine report", icon: ClipboardListIcon, href: (base) => `${base}/export` },
];

/**
 * The phone's record tabs, in thumb reach: Medicines, a raised Add, and Report. Wider screens keep the
 * tabs at the top (RecordHeader). Lives in the record's layout, so it stays put between tabs and the
 * indicator slides. globals.css pads the page shell by the bar's height while it's shown, so the footer stays above it.
 */
export function BottomBar({ patientId }: { patientId: string }) {
  const { current, hidden } = recordNav(usePathname());
  if (hidden) return null;
  const base = `/patients/${patientId}`;
  const [medicines, report] = TABS;

  return (
    <nav
      aria-label="Record"
      data-bottom-bar
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/88 sm:hidden"
    >
      <ul className="mx-auto grid h-16 max-w-md grid-cols-3 items-stretch">
        <Tab tab={medicines} base={base} active={current === medicines.id} />
        <li className="grid place-items-center">
          <Link
            href={`${base}/add`}
            aria-label="Add a medicine"
            className="press -mt-6 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background focus-visible:ring-ring/60 focus-visible:outline-none"
          >
            <PlusIcon aria-hidden className="size-6" strokeWidth={2.5} />
          </Link>
        </li>
        <Tab tab={report} base={base} active={current === report.id} />
      </ul>
    </nav>
  );
}

function Tab({ tab, base, active }: { tab: (typeof TABS)[number]; base: string; active: boolean }) {
  const Icon = tab.icon;
  return (
    <li className="relative">
      {active ? (
        <motion.span
          layoutId="bottom-bar-indicator"
          transition={spring.snappy}
          aria-hidden
          className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-primary"
        />
      ) : null}
      <Link
        href={tab.href(base)}
        aria-current={active ? "page" : undefined}
        aria-label={tab.name === tab.label ? undefined : tab.name}
        className={cn(
          "press flex h-full flex-col items-center justify-center gap-1 text-xs font-medium focus-visible:bg-muted focus-visible:outline-none",
          active ? "text-primary" : "text-muted-foreground",
        )}
      >
        <Icon aria-hidden className="size-5" />
        {tab.label}
      </Link>
    </li>
  );
}
