// STUB (M0). Feature C replaces the body; props are fixed so the record page can render it.
import type { CheckRun } from "@/lib/domain/schema";

export function ChecksPanel({ runs }: { runs: CheckRun[] }) {
  return (
    <section aria-labelledby="checks-heading" className="rounded-xl border p-4">
      <h2 id="checks-heading" className="font-semibold">
        Checks run
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{runs.length} checks</p>
    </section>
  );
}
