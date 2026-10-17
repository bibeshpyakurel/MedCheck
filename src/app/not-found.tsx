import { ArrowLeftIcon, SearchXIcon } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <AppShell>
      <div className="mx-auto flex max-w-md flex-col items-center py-12 text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-muted text-muted-foreground ring-1 ring-border">
          <SearchXIcon aria-hidden className="size-7" />
        </span>
        <p className="mt-6 font-mono text-xs font-medium tracking-wider text-muted-foreground uppercase">404</p>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">We couldn&apos;t find that page</h1>
        <p className="mt-2 text-muted-foreground text-pretty">
          The record may have been reset or removed, or the link is incomplete.
        </p>
        <Button className="mt-8 h-11 px-4" nativeButton={false} render={<Link href="/" />}>
          <ArrowLeftIcon aria-hidden /> Back to MedCheck
        </Button>
      </div>
    </AppShell>
  );
}
