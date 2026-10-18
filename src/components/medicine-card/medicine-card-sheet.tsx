"use client";

// The medicine card in an overlay: a bottom sheet on phones, a centered dialog from `sm:` up. One
// Dialog restyled per breakpoint rather than a Sheet and a Dialog switched by a media query.
import { XIcon } from "lucide-react";
import type { ReactNode } from "react";
import { MedicineCard } from "@/components/medicine-card/medicine-card";
import type { CardTab } from "@/components/medicine-card/medicine-card-tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { Formulation } from "@/lib/domain/schema";

export function MedicineCardSheet({
  formulation,
  open,
  onOpenChange,
  footer,
  actions,
  defaultTab,
}: {
  formulation: Formulation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The caller's actions (e.g. "Done"), pinned below the scrolling card. */
  footer?: ReactNode;
  /** Under the card's status chip (Compare with my medicines). */
  actions?: ReactNode;
  defaultTab?: CardTab;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-auto bottom-0 left-0 flex max-h-[90dvh] max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-t-2xl rounded-b-none p-0 max-sm:data-open:slide-in-from-bottom-8 sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-h-[85dvh] sm:max-w-2xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl"
      >
        <div className="flex shrink-0 items-start gap-2 border-b py-2 pr-2 pl-5">
          <DialogTitle className="min-w-0 flex-1 py-2.5 text-xl text-balance">{formulation.brandName}</DialogTitle>
          <DialogClose render={<Button variant="ghost" size="icon" className="size-11" />}>
            <XIcon aria-hidden className="size-5" />
            <span className="sr-only">Close</span>
          </DialogClose>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
          <MedicineCard formulation={formulation} showTitle={false} actions={actions} defaultTab={defaultTab} />
        </div>
        {footer && (
          <div className="flex shrink-0 flex-col-reverse gap-2 border-t bg-muted/50 px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end">
            {footer}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
