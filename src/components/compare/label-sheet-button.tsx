"use client";

// "Inspect labels": a compared product's medicine card, opened on its Original FDA label tab.
import { FileTextIcon } from "lucide-react";
import { useState } from "react";
import { MedicineCardSheet } from "@/components/medicine-card/medicine-card-sheet";
import { Button } from "@/components/ui/button";
import { useBackToClose } from "@/components/use-back-to-close";
import type { Formulation } from "@/lib/domain/schema";

export function LabelSheetButton({ formulation }: { formulation: Formulation }) {
  const [open, setOpen] = useState(false);
  useBackToClose(open, () => setOpen(false));
  return (
    <>
      <Button variant="outline" className="h-11 max-w-full px-4" onClick={() => setOpen(true)}>
        <FileTextIcon aria-hidden />
        <span className="truncate">{formulation.brandName} label</span>
      </Button>
      <MedicineCardSheet formulation={formulation} open={open} onOpenChange={setOpen} defaultTab="original" />
    </>
  );
}
