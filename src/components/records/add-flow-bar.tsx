import { XIcon } from "lucide-react";
import { discardDraftAction } from "@/app/patients/[patientId]/entries/[entryId]/discard-action";
import { BackLink } from "@/components/back-link";
import { ConfirmAction } from "@/components/records/confirm-action";
import { addFlowStep, type AddFlowScreen } from "@/lib/add-flow";
import { cn } from "@/lib/utils";

/**
 * The top of every add-a-medicine screen, in place of the Medicines / Medicine report tabs: Cancel and
 * how far along this is. Before a photo is read Cancel just returns to the Medicines page; after,
 * there is a medicine waiting for review (`draftId`), so Cancel asks and then deletes it.
 */
export function AddFlowBar({
  patientId,
  screen,
  draftId,
}: {
  patientId: string;
  screen: Exclude<AddFlowScreen, "saved">;
  draftId?: string;
}) {
  const { step, total, label } = addFlowStep(screen);
  return (
    <div className="mb-6 flex items-center justify-between gap-3">
      {draftId ? (
        <ConfirmAction
          action={discardDraftAction.bind(null, { patientId, entryId: draftId })}
          variant="ghost"
          className="-ml-2 h-11 gap-2 px-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          title="Discard this medicine?"
          description="The photo and what MedCheck read won't be kept, and nothing is added to your medicines."
          confirmLabel="Discard"
          pendingLabel="Discarding…"
        >
          {/* Drawn like BackLink's icon, so both Cancels look the same. */}
          <span className="grid size-6 place-items-center rounded-md border bg-card shadow-xs">
            <XIcon aria-hidden className="size-3.5" />
          </span>
          Cancel
        </ConfirmAction>
      ) : (
        <BackLink href={`/patients/${patientId}`} icon="close">
          Cancel
        </BackLink>
      )}
      <div className="flex flex-col items-end gap-1.5">
        <p className="text-sm font-medium text-muted-foreground nums">{label}</p>
        <div aria-hidden className="flex gap-1">
          {/* The step just reached fills in from the left. */}
          {Array.from({ length: total }, (_, i) => (
            <span key={i} className="h-1 w-8 overflow-hidden rounded-full bg-muted">
              {i < step && <span className={cn("block h-full origin-left rounded-full bg-primary", i === step - 1 && step > 1 && "animate-fill-x")} />}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
