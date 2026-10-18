// Quick View: the label's own words, arranged to read at a glance. No "use client".
import { GoodToKnow } from "@/components/medicine-card/good-to-know";
import { IngredientHero } from "@/components/medicine-card/ingredient-hero";
import { LabelDirections } from "@/components/medicine-card/label-directions";
import { SourceStatus } from "@/components/medicine-card/source-status";
import { UsesGrid } from "@/components/medicine-card/uses-grid";
import { WarningCards } from "@/components/medicine-card/warning-cards";
import type { MedicationFacts } from "@/lib/medication-facts";

export function QuickView({ facts, idPrefix }: { facts: MedicationFacts; idPrefix: string }) {
  const id = (key: string) => `${idPrefix}-${key}`;
  return (
    <div className="space-y-8">
      <IngredientHero hero={facts.hero} id={id("hero")} />
      <UsesGrid groups={facts.uses} id={id("uses")} />
      <LabelDirections directions={facts.directions} id={id("directions")} />
      <WarningCards warnings={facts.warnings} overdose={facts.overdose} id={id("warnings")} />
      <GoodToKnow tiles={facts.goodToKnow} id={id("good")} />
      <SourceStatus facts={facts} id={id("source")} />
    </div>
  );
}
