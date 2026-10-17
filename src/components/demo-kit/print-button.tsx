"use client";

import { PrinterIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <Button size="lg" className="h-11 px-4" onClick={() => window.print()}>
      <PrinterIcon aria-hidden />
      Print the kit
    </Button>
  );
}
