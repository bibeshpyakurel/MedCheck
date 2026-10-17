"use client";

import type { ComponentProps, ReactNode, Ref } from "react";
import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { SubmitButton } from "@/components/records/submit-button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

/**
 * A button that explains what will change and asks before running a server action that replaces or
 * removes records. Cancel has focus when the dialog opens, so Enter or Escape never loses anything.
 */
export function ConfirmAction({
  action,
  children,
  title,
  description,
  confirmLabel,
  pendingLabel,
  variant = "outline",
  className,
}: {
  action: () => Promise<void>;
  /** The trigger button's content. */
  children: ReactNode;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  pendingLabel: string;
  variant?: ComponentProps<typeof Button>["variant"];
  className?: string;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant={variant} className={className} />}>{children}</AlertDialogTrigger>
      <AlertDialogContent initialFocus={cancelRef}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <form action={action} className="contents">
          <AlertDialogFooter>
            <CancelButton ref={cancelRef} />
            <SubmitButton variant="destructive" className="h-11 px-4" pendingLabel={pendingLabel}>
              {confirmLabel}
            </SubmitButton>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Cancel stays available until the action starts; after that the change can't be called back. */
function CancelButton({ ref }: { ref: Ref<HTMLButtonElement> }) {
  const { pending } = useFormStatus();
  return (
    <AlertDialogCancel ref={ref} type="button" className="h-11 px-4" disabled={pending}>
      Cancel
    </AlertDialogCancel>
  );
}
