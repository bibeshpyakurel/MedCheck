import { FlaskConicalIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/** Marks a demo household. All of its data is synthetic. */
export function DemoBadge() {
  return (
    <Badge variant="outline" className="h-6 gap-1 px-2 text-xs font-medium text-muted-foreground">
      <FlaskConicalIcon aria-hidden />
      Demo data — synthetic
    </Badge>
  );
}
