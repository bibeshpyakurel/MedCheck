import Link from "next/link";
import type { ReactNode } from "react";
import { GetHelp } from "@/components/already-gave-both";
import { BrandLogo } from "@/components/brand";
import { GuestLeaveGuard } from "@/components/guest-leave-guard";
import { SiteMenu } from "@/components/site-menu";
import { getAccount } from "@/lib/auth";
import { cn } from "@/lib/utils";

/**
 * Page chrome shared by every screen: brand, content column, and a one-line boundary statement.
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

// One quiet line, so short pages fit on a phone screen. Poison Control lives in the header's "Get help".
function SiteFooter() {
  return (
    <footer className="border-t">
      <p className="mx-auto w-full max-w-6xl px-4 py-3 text-center text-xs leading-relaxed text-muted-foreground text-pretty sm:px-6">
        <strong className="font-semibold text-foreground/80">Evidence, not advice.</strong>
        {/* One line on a phone; the full sentence would wrap and make short pages scroll. */}
        <span className="hidden sm:inline">
          {" "}
          MedCheck shows what labels say — it never calculates a dose or says a combination is safe.
        </span>
      </p>
    </footer>
  );
}
