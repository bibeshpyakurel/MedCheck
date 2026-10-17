"use client";

import { PillIcon, RotateCcwIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { BrandLogo } from "@/components/brand";
import { Button } from "@/components/ui/button";

/**
 * What error.tsx and global-error.tsx show: plain words, Try again, a way back into the app, and the
 * error's reference so support can find it in the server logs.
 */
export function ErrorPanel({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const digest = error instanceof Error && "digest" in error && typeof error.digest === "string" ? error.digest : null;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border/70 bg-background/80">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center px-4 sm:px-6">
          <Link href="/" className="-m-1.5 rounded-lg p-1.5 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
            <BrandLogo />
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <div role="alert" className="mx-auto max-w-md py-6 text-center sm:py-10">
          <TriangleAlertIcon aria-hidden className="mx-auto size-10 text-unresolved" />
          <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight">Something went wrong</h1>
          <p className="mt-2 text-muted-foreground text-pretty">
            MedCheck couldn&apos;t load this page. Try again — if it keeps happening, go back to your medicines and open it
            from there.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button size="lg" className="h-12 px-5 text-base" onClick={() => retry()}>
              <RotateCcwIcon aria-hidden /> Try again
            </Button>
            <Button variant="outline" size="lg" className="h-12 px-5 text-base" nativeButton={false} render={<Link href="/patients" />}>
              <PillIcon aria-hidden /> Back to my medicines
            </Button>
          </div>
          <Button variant="ghost" className="mt-3 h-11 px-4" nativeButton={false} render={<Link href="/" />}>
            Go to the start page
          </Button>
          {digest ? (
            <p className="mt-6 text-xs text-muted-foreground">
              If you contact support, mention this reference: <code className="font-mono text-foreground">{digest}</code>
            </p>
          ) : null}
        </div>
      </main>
    </div>
  );
}
