import { ArrowLeftIcon, SearchXIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { getAccount } from "@/lib/auth";

export const metadata: Metadata = { title: "Page not found" };

/** Unknown URLs and records that don't exist (or were removed). */
export default async function NotFound() {
  const account = await getAccount();

  return (
    <AppShell>
      <div className="mx-auto flex max-w-md flex-col items-center py-12 text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-muted text-muted-foreground ring-1 ring-border">
          <SearchXIcon aria-hidden className="size-7" />
        </span>
        <p className="mt-6 font-mono text-xs font-medium tracking-wider text-muted-foreground uppercase">404</p>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">We couldn&apos;t find that page</h1>
        <p className="mt-2 text-muted-foreground text-pretty">
          The link may be wrong, or what it points to was removed.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {account ? (
            <Button
              className="h-11 px-4"
              nativeButton={false}
              render={<Link href={account.patientId ? `/patients/${account.patientId}` : "/patients"} />}
            >
              <ArrowLeftIcon aria-hidden /> Back to my medicines
            </Button>
          ) : null}
          <Button
            variant={account ? "outline" : "default"}
            className="h-11 px-4"
            nativeButton={false}
            render={<Link href="/" />}
          >
            Go to the start page
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
