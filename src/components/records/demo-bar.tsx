import "server-only";

import { FlaskConicalIcon, LogOutIcon } from "lucide-react";
import { exitDemo } from "@/app/actions/session";
import { ConfirmAction } from "@/components/records/confirm-action";
import { getCurrentUser } from "@/lib/auth";
import { hasOwnRecords } from "@/lib/demo/household";
import { getCaregiver, listPatients } from "@/lib/records";

/** A strip under the header while the demo household is in the user's records, with the way out of it. */
export async function DemoBar() {
  if (!(await getCurrentUser())) return null;
  const [caregiver, patients] = await Promise.all([getCaregiver(), listPatients()]);
  if (!patients.some((p) => p.isDemo)) return null;
  const keepsOwn = hasOwnRecords(caregiver?.displayName ?? null, patients);

  return (
    <div className="border-b bg-muted/60">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 text-sm sm:px-6">
        <p className="flex min-w-0 items-center gap-2 text-muted-foreground">
          <FlaskConicalIcon aria-hidden className="size-4 shrink-0" />
          <span>You&apos;re in the demo household. Everything in it is made up.</span>
        </p>
        <ConfirmAction
          action={exitDemo}
          variant="ghost"
          className="h-11 shrink-0 px-3"
          title="Exit the demo?"
          description={
            keepsOwn
              ? "This removes the demo household and any changes you made to it. Your own records stay, and you'll go back to them."
              : "This removes the demo household and any changes you made to it, and ends this demo session. You'll go back to the start page, where you can start your own records."
          }
          confirmLabel="Exit demo"
          pendingLabel="Exiting…"
        >
          <LogOutIcon aria-hidden /> Exit demo
        </ConfirmAction>
      </div>
    </div>
  );
}
