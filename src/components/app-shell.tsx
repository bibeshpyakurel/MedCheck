import { PhoneIcon, ShieldCheckIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { GetHelp } from "@/components/already-gave-both";
import { BrandLogo } from "@/components/brand";
import { GuestLeaveGuard } from "@/components/guest-leave-guard";
import { SiteMenu } from "@/components/site-menu";
import { getAccount } from "@/lib/auth";
import { cn } from "@/lib/utils";

/**
 * Page chrome shared by every screen: brand, demo strip, content column, and the boundary statement.
 * `bleed` hands the full width to the page (the landing page draws its own sections).
 * "Get help" (the fixed "I already gave both" message) is in the header on every screen; the ☰ menu holds the explainer pages.
 */
export async function AppShell({
  children,
  bleed = false,
}: {
  children: ReactNode;
  bleed?: boolean;
}) {
  const account = await getAccount();
  return (
    <div className="flex min-h-dvh flex-col">
      <GuestLeaveGuard isGuest={account?.isGuest === true} />
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-1">
            <SiteMenu account={account} />
            <Link
              href="/"
              className="rounded-lg p-1.5 transition-opacity hover:opacity-85 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <BrandLogo />
            </Link>
          </div>
          <GetHelp />
        </div>
      </header>
      <main className={cn("w-full flex-1", !bleed && "mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12")}>{children}</main>
      <SiteFooter />
    </div>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t bg-surface">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] md:items-start">
        <div className="space-y-4">
          <BrandLogo markClassName="size-7" />
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground text-pretty">
            <strong className="font-semibold text-foreground">Evidence, not advice.</strong> MedCheck shows what labels and
            documents say and organizes questions for a pharmacist. It never calculates a dose or says a combination is safe.
          </p>
          <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheckIcon aria-hidden className="size-3.5" />
            Demo — use made-up information.{" "}
            <Link href="/demo-kit" className="font-medium text-foreground underline-offset-4 hover:underline">
              Printable demo kit
            </Link>
          </p>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <p className="text-sm font-semibold">Already gave or took a double dose?</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Call Poison Control at{" "}
            <a className="font-semibold text-foreground underline underline-offset-4 nums" href="tel:18002221222">
              1-800-222-1222
            </a>{" "}
            or talk to a pharmacist.
          </p>
          <a
            href="tel:18002221222"
            className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-ink text-sm font-medium text-ink-foreground transition-opacity hover:opacity-90 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <PhoneIcon aria-hidden className="size-4" /> Call Poison Control
          </a>
        </div>
      </div>
    </footer>
  );
}
