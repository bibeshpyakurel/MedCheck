import { AppShell } from "@/components/app-shell";
import { Skeleton } from "@/components/ui/skeleton";

/** Shown while a person's record (or one of its pages) loads on the server. Mirrors the record header and the Medicines tab. */
export default function Loading() {
  return (
    <AppShell>
      <div role="status" aria-label="Loading" className="mx-auto max-w-4xl space-y-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="size-7 rounded-full" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-12 w-full rounded-xl sm:w-[22rem]" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-36 rounded-2xl" />
        <div className="space-y-3">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      </div>
    </AppShell>
  );
}
