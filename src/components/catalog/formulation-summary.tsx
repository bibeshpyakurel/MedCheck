import { Badge } from "@/components/ui/badge";
import { formatStrength } from "@/lib/domain/fields";
import type { Formulation } from "@/lib/domain/schema";
import { catalogLabelSource } from "@/lib/record-format";

/** Brand, active ingredients with strengths as printed, and where the label came from. */
export function FormulationSummary({ formulation: f, headingLevel = "h2" }: { formulation: Formulation; headingLevel?: "h2" | "h3" }) {
  const Heading = headingLevel;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Heading className="text-lg font-semibold leading-tight">{f.brandName}</Heading>
        {f.isFictional && <Badge variant="outline">Fictional product</Badge>}
      </div>
      <p className="text-sm text-muted-foreground">
        {f.genericName} · {f.dosageForm}
      </p>
      <ul className="space-y-0.5 text-sm">
        {f.activeIngredients.map((i) => (
          <li key={i.normalized}>
            <span className="font-medium">{i.name}</span> {formatStrength(i.strength)}
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">{catalogLabelSource(f)}</p>
    </div>
  );
}
