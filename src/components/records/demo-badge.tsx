import { FlaskConicalIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Marks a demo household. All of its data is made up. */
export function DemoBadge({ className }: { className?: string }) {
  return (
    <Badge variant="outline" className={cn("h-6 gap-1 px-2 text-xs font-medium text-muted-foreground", className)}>
      <FlaskConicalIcon aria-hidden />
      Demo — made-up information
    </Badge>
  );
}
