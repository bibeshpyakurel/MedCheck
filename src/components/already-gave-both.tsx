"use client";

import { LifeBuoyIcon, PhoneIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";

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

const TITLE = "Already gave or took both?";
const DESCRIPTION = "MedCheck can't tell you what to do next. A person can.";

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
          <DialogTitle>{TITLE}</DialogTitle>
          <DialogDescription>{DESCRIPTION}</DialogDescription>
        </DialogHeader>
        <AlreadyGaveBothMessage />
        <DialogFooter>
          <DialogClose render={<Button variant="ghost" />}>Close</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The header's "Get help": the same fixed message, on every screen. A native popover rather than the
 * Dialog above, so it opens on the first tap even before the page's JavaScript has loaded — the moment
 * someone needs it is not the moment to wait for hydration. It never navigates, so nothing in progress
 * (like a review) is lost.
 */
export function GetHelp() {
  return (
    <>
      <button type="button" popoverTarget="get-help" className={cn(buttonVariants({ variant: "ghost" }), "h-11 px-3")}>
        <LifeBuoyIcon aria-hidden /> Get help
      </button>
      <div
        id="get-help"
        popover="auto"
        role="dialog"
        aria-labelledby="get-help-title"
        aria-describedby="get-help-description"
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border bg-popover p-5 text-popover-foreground shadow-2xl backdrop:bg-black/40"
      >
        <h2 id="get-help-title" className="text-lg font-semibold">
          {TITLE}
        </h2>
        <p id="get-help-description" className="mt-1 mb-4 text-sm text-muted-foreground">
          {DESCRIPTION}
        </p>
        <AlreadyGaveBothMessage />
        <button
          type="button"
          popoverTarget="get-help"
          popoverTargetAction="hide"
          className={cn(buttonVariants({ variant: "ghost" }), "mt-2 h-11 w-full")}
        >
          Close
        </button>
      </div>
    </>
  );
}
