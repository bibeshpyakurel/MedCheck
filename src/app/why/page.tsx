import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Why it matters" };

// Public and static: no session, no data access.
export default function WhyPage() {
  return (
    <AppShell>
      <PageHeader
        title="Why it matters"
        description="Caregivers have it hardest. MedCheck is built for the moment a second medicine comes into the house."
      />
      <dl className="mt-10 grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-2">
        <Stat value="63M" label="Americans care for someone else" source="AARP, 2025" />
        <Stat value="1 in 5" label="caregivers has any training in managing their medicines" source="AARP, 2025" />
      </dl>
    </AppShell>
  );
}

function Stat({ value, label, source }: { value: string; label: string; source?: string }) {
  return (
    <div className="flex flex-col gap-1 bg-card p-6">
      <dt className="order-2 text-sm leading-snug text-muted-foreground">
        {label}
        {source ? <span className="mt-1 block text-xs text-muted-foreground/80">{source}</span> : null}
      </dt>
      <dd className="order-1 font-display text-4xl font-semibold tracking-tight nums">{value}</dd>
    </div>
  );
}
