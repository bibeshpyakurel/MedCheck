import { ArrowLeftIcon, SearchXIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Page not found" };

/** Unknown URLs and records that don't exist (or were removed, e.g. by resetting the demo). */
export default async function NotFound() {
  const user = await getCurrentUser();

  return (
    <AppShell>
      <div className="mx-auto max-w-md py-6 text-center sm:py-10">
        <SearchXIcon aria-hidden className="mx-auto size-10 text-muted-foreground" />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">We couldn&apos;t find that page</h1>
        <p className="mt-2 text-muted-foreground text-pretty">
          The link may be wrong, or the record it points to was removed — for example after the demo household was
          reset.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {user ? (
            <Button size="lg" className="h-12 px-5 text-base" nativeButton={false} render={<Link href="/patients" />}>
              <ArrowLeftIcon aria-hidden /> Back to your people
            </Button>
          ) : null}
          <Button
            variant={user ? "outline" : "default"}
            size="lg"
            className="h-12 px-5 text-base"
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
