import { ArrowRightIcon, CircleDashedIcon, MessageCircleQuestionIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { AttentionSummary as Summary } from "@/lib/checks/summary";
import { cn } from "@/lib/utils";

/**
 * The compact status at the top of a person's medicines: how many questions the checks raised,
 * the leading one, and any check that needs more details. Never green and never "all clear":
 * with no findings it says only that nothing was found in confirmed fields.
 */
export function AttentionSummary({ summary, href, compared }: { summary: Summary; href: string; compared: string }) {
  const Icon = summary.tone === "finding" ? MessageCircleQuestionIcon : summary.tone === "unresolved" ? CircleDashedIcon : SearchIcon;
  return (
    <section
      aria-labelledby="attention-heading"
      className={cn(
        "rounded-2xl border p-4 sm:p-5",
        summary.tone === "finding" && "border-finding/40 bg-finding-surface/70",
        summary.tone === "unresolved" && "border-unresolved/35 bg-unresolved-surface/70",
        summary.tone === "neutral" && "bg-card",
      )}
    >
      <div className="flex items-start gap-3">
        <Icon
          aria-hidden
          className={cn(
            "mt-0.5 size-5 shrink-0",
            summary.tone === "finding" && "text-finding",
            summary.tone === "unresolved" && "text-unresolved",
            summary.tone === "neutral" && "text-muted-foreground",
          )}
        />
        <div className="min-w-0 flex-1 space-y-1">
          <h2 id="attention-heading" className="text-lg leading-snug font-semibold">
            {summary.headline}
          </h2>
          {summary.lead ? <p className="text-pretty">{summary.lead}</p> : null}
          {summary.needsDetails ? (
            <p className="font-medium text-unresolved-foreground">{summary.needsDetails}</p>
          ) : null}
          <p className="text-sm text-muted-foreground nums">{compared}</p>
        </div>
      </div>
      <Button
        variant={summary.tone === "finding" ? "default" : "outline"}
        className="mt-4 h-11 w-full px-4 sm:w-auto"
        nativeButton={false}
        render={<Link href={href} />}
      >
        {summary.tone === "finding" ? "See the questions" : "See the checks"} <ArrowRightIcon aria-hidden />
      </Button>
    </section>
  );
}
