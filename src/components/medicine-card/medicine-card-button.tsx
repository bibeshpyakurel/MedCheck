"use client";

import { BookOpenTextIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { MedicineCardSheet } from "@/components/medicine-card/medicine-card-sheet";
import { Button } from "@/components/ui/button";
import type { Formulation } from "@/lib/domain/schema";

/**
 * "View medicine card" on the entry page of a catalog-linked medicine. `justAdded` opens the card on
 * arrival (right after the one-tap confirm) with Done (→ Medicines) and Add another (→ capture).
 * `formulation` must come from a catalog read (`rowToFormulation` sanitizes its dosing table).
 */
export function MedicineCardButton({
  formulation,
  patientId,
  justAdded = false,
}: {
  formulation: Formulation;
  patientId: string;
  justAdded?: boolean;
}) {
  const [open, setOpen] = useState(justAdded);
  const [showFooter, setShowFooter] = useState(justAdded);
  const router = useRouter();
  const pathname = usePathname();

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next && showFooter) {
      // Closed after adding: stay on the entry page; a reload shouldn't reopen the card.
      setShowFooter(false);
      router.replace(pathname, { scroll: false });
    }
  }

  return (
    <>
      <Button variant="outline" className="h-11 px-4" onClick={() => setOpen(true)}>
        <BookOpenTextIcon aria-hidden /> View medicine card
      </Button>
      <MedicineCardSheet
        formulation={formulation}
        open={open}
        onOpenChange={onOpenChange}
        footer={
          showFooter ? (
            <>
              <p role="status" className="self-center text-sm text-muted-foreground sm:mr-auto">
                Saved to the Medicines page.
              </p>
              <Button
                variant="outline"
                className="h-11 px-4 text-base"
                nativeButton={false}
                render={<Link href={`/patients/${patientId}/add`} />}
              >
                <PlusIcon aria-hidden /> Add another
              </Button>
              <Button className="h-11 px-5 text-base" nativeButton={false} render={<Link href={`/patients/${patientId}`} />}>
                Done
              </Button>
            </>
          ) : undefined
        }
      />
    </>
  );
}
