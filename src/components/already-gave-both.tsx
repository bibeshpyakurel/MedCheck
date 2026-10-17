"use client";

import { PhoneIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** The fixed message. Wording is a product decision — do not change it or add guidance. */
export const ALREADY_GAVE_BOTH_MESSAGE =
  "Contact a pharmacist or Poison Control at 1-800-222-1222.";

export function AlreadyGaveBothMessage() {
  return (
    <div className="space-y-4">
      <p className="rounded-xl border bg-surface p-4 text-base font-medium">{ALREADY_GAVE_BOTH_MESSAGE}</p>
      <Button
        nativeButton={false}
        render={<a href="tel:18002221222" />}
        size="lg"
        className="h-12 w-full text-base"
      >
        <PhoneIcon aria-hidden /> Call Poison Control
      </Button>
    </div>
  );
}

/**
 * "I already gave both" — always shows the same fixed message. `defaultOpen` lets the
 * describe flow open it when someone says they already gave or took a double dose.
 */
export function AlreadyGaveBoth({ defaultOpen = false }: { defaultOpen?: boolean }) {
  return (
    <Dialog defaultOpen={defaultOpen}>
      <DialogTrigger render={<Button variant="outline" size="lg" className="h-11 px-4" />}>I already gave both</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Already gave or took both?</DialogTitle>
          <DialogDescription>MedCheck can&apos;t tell you what to do next. A person can.</DialogDescription>
        </DialogHeader>
        <AlreadyGaveBothMessage />
        <DialogFooter>
          <DialogClose render={<Button variant="ghost" />}>Close</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
