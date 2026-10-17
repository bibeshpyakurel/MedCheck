import { AppShell } from "@/components/app-shell";
import { Skeleton } from "@/components/ui/skeleton";

/** Shown while a person's record (or one of its pages) loads on the server. */
export default function Loading() {
  return (
    <AppShell>
      <div role="status" aria-label="Loading" className="space-y-8">
        <div className="flex items-center gap-4">
          <Skeleton className="size-14 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
          <div className="space-y-3">
            <Skeleton className="h-11 w-64" />
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
          </div>
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </div>
    </AppShell>
  );
}
