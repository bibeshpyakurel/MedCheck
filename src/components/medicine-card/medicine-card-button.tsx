"use client";

import { BookOpenTextIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MedicineCardSheet } from "@/components/medicine-card/medicine-card-sheet";
import { Button } from "@/components/ui/button";
import { useBackToClose } from "@/components/use-back-to-close";
import type { Formulation } from "@/lib/domain/schema";

// Entry pages whose just-added card already opened. Back restores the page as first rendered (with
// `justAdded`), and the card shouldn't open again. A full reload clears this, but by then `?card=new` is gone.
const shownOnArrival = new Set<string>();

/**
 * "View medicine card" on the entry page of a catalog-linked medicine. `justAdded` opens the card on
 * arrival (right after the one-tap confirm) with Done and Add another; then ×, Escape and Done all go to
 * the Medicines page. Device Back closes the card and stays on the entry page.
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
  const pathname = usePathname();
  const [arriving] = useState(() => justAdded && !shownOnArrival.has(pathname));
  const [open, setOpen] = useState(arriving);
  const [showFooter, setShowFooter] = useState(arriving);
  const router = useRouter();
  const record = `/patients/${patientId}`;
  const release = useBackToClose(open, () => {
    setOpen(false);
    setShowFooter(false);
  });

  // A reload, or coming Back to this page later, shouldn't reopen the card: drop `?card=new` once it opened.
  useEffect(() => {
    if (!arriving) return;
    shownOnArrival.add(pathname);
    window.history.replaceState(null, "", pathname);
  }, [arriving, pathname]);

  function onOpenChange(next: boolean) {
    if (next || !showFooter) return setOpen(next);
    // × or Escape right after adding: the same place as Done.
    release();
    router.replace(record);
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
                render={<Link href={`/patients/${patientId}/add`} replace onClick={release} />}
              >
                <PlusIcon aria-hidden /> Add another
              </Button>
              <Button className="h-11 px-5 text-base" nativeButton={false} render={<Link href={record} replace onClick={release} />}>
                Done
              </Button>
            </>
          ) : undefined
        }
      />
    </>
  );
}
