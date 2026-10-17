import { cn } from "cn";
import type { ReactNode } from "react";
import { Brand } from "@/components/brand";
import { DemoBar } from "@/components/records/demo-bar";

/**
 * Page chrome shared by every screen: brand, demo strip, content column, and the boundary statement.
 * `mobileActionBar`: the page pins a bar (one row of h-11 buttons) to the bottom of phone screens;
 * the footer gets room underneath it so the Poison Control link is never covered.
 */
export function AppShell({
  children,
  actions,
  mobileActionBar = false,
}: {
  children: ReactNode;
  actions?: ReactNode;
  mobileActionBar?: boolean;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-4">
          <Brand />
          <div className="flex items-center gap-2">{actions}</div>
        </div>
      </header>
      <DemoBar />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-10">{children}</main>
      <footer className={cn("border-t", mobileActionBar && "pb-[calc(4.5rem+env(safe-area-inset-bottom))] sm:pb-0")}>
        <div className="mx-auto w-full max-w-5xl px-4 py-5 text-sm text-muted-foreground">
          <p>
            <strong className="font-medium text-foreground">Evidence, not advice.</strong> MedCheck shows what labels and
            documents say and organizes questions for a pharmacist. It never calculates a dose or says a combination is safe.
          </p>
          <p className="mt-2">
            Already gave or took a double dose? Call Poison Control at{" "}
            <a className="font-medium text-foreground underline underline-offset-4" href="tel:18002221222">
              1-800-222-1222
            </a>{" "}
            or talk to a pharmacist.
          </p>
        </div>
      </footer>
    </div>
  );
}
