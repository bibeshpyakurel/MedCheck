"use client";

import { CheckIcon, CircleHelpIcon, PencilIcon } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { Field, FieldState } from "@/lib/domain/schema";
import { cn } from "@/lib/utils";
import { ShowEditorErrors } from "./editors";
import { EvidenceCrop } from "./evidence-crop";
import { applyEdit, markMatches, markUnknown } from "./field-actions";
import { DECISION_LABELS, neverOnSource, type ReviewSource } from "./review-status";

const STATE_TEXT: Record<FieldState, Record<ReviewSource, string>> = {
  pending: { label: "Needs your decision", description: "Needs your decision" },
  confirmed: { label: "Matches the label", description: "Matches what you said" },
  edited: { label: "You changed this", description: "You changed this" },
  unknown: { label: "Unknown", description: "Unknown" },
};

const DECISION_BUTTON = "h-auto min-h-11 px-2 py-2 text-center leading-tight whitespace-normal";

/**
 * One reviewed value: where it came from | what MedCheck read | Matches / Change it / I can't read it
 * (→ confirmed / edited / unknown). `editor` renders the input while changing it.
 */
export function FieldRow<T>({
  label,
  field,
  onChange,
  format,
  editor,
  photoUrl,
  source,
  actions,
  className,
}: {
  label: string;
  field: Field<T>;
  onChange: (field: Field<T>) => void;
  format: (value: T) => string;
  editor: (value: T | null, setValue: (value: T | null) => void) => ReactNode;
  photoUrl: string | null;
  source: ReviewSource;
  actions?: ReactNode;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<T | null>(null);
  // Save attempts with an invalid value: the editor shows its errors and we focus the first one.
  const [rejectedSaves, setRejectedSaves] = useState(0);
  const editorRef = useRef<HTMLDivElement>(null);
  const words = DECISION_LABELS[source];
  // A catalog label that never had this value (e.g. no written dose) isn't something the user couldn't read.
  const absent = neverOnSource(field);

  useEffect(() => {
    if (rejectedSaves) editorRef.current?.querySelector<HTMLElement>("[aria-invalid=true]")?.focus();
  }, [rejectedSaves]);

  function startEdit() {
    setDraft(field.value ?? field.aiValue);
    setRejectedSaves(0);
    setEditing(true);
  }

  function save() {
    // Editors report null while what's typed isn't valid; keep editing (and the typed text) until it is.
    // An empty or invalid value never becomes unknown — only "I can't read it" does.
    if (draft === null) return setRejectedSaves((n) => n + 1);
    onChange(applyEdit(field, draft));
    setEditing(false);
  }

  const stateText =
    field.state === "unknown" && absent
      ? source === "label"
        ? "Not on the label"
        : "Not in what you said"
      : STATE_TEXT[field.state][source];

  return (
    <div className={cn("space-y-3 py-4", className)} data-state={field.state}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold">{label}</h3>
          <p
            className={cn(
              "mt-0.5 flex items-center gap-1.5 text-sm",
              field.state === "pending" ? "font-medium text-unresolved-foreground" : "text-muted-foreground",
            )}
          >
            {field.state === "confirmed" || field.state === "edited" ? <CheckIcon aria-hidden className="size-3.5" /> : null}
            {stateText}
          </p>
        </div>
        {actions}
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,14rem)_1fr] sm:items-start">
        <div>
          {field.evidence.kind === "crop" || field.evidence.kind === "photo" || field.evidence.kind === "none" ? (
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">On the label</p>
          ) : null}
          <EvidenceCrop evidence={field.evidence} photoUrl={photoUrl} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">
            {field.state === "edited" ? "You changed it to" : "MedCheck read"}
          </p>
          {field.value !== null ? (
            <p className="mt-0.5 text-lg font-semibold break-words nums">{format(field.value)}</p>
          ) : (
            <p className="mt-0.5 text-base text-muted-foreground">
              {field.state === "unknown" ? "Unknown" : "Nothing — use Change it to type it"}
            </p>
          )}
          {field.state === "edited" && field.aiValue !== null && (
            <p className="mt-1 text-sm text-muted-foreground">MedCheck read: {format(field.aiValue)}</p>
          )}
          {field.state === "unknown" && !absent && (
            <p className="mt-1 text-sm text-muted-foreground">MedCheck will leave this detail unknown.</p>
          )}
        </div>
      </div>

      {editing ? (
        <div ref={editorRef} className="space-y-3 rounded-xl bg-surface p-3 ring-1 ring-border">
          <ShowEditorErrors.Provider value={rejectedSaves > 0}>{editor(draft, setDraft)}</ShowEditorErrors.Provider>
          <div className="flex gap-2">
            <Button type="button" className="h-11 flex-1" onClick={save}>
              Save
            </Button>
            <Button type="button" variant="ghost" className="h-11" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2" role="group" aria-label={`Review ${label}`}>
          <Button
            type="button"
            variant={field.state === "confirmed" ? "default" : "outline"}
            className={DECISION_BUTTON}
            disabled={field.value === null}
            aria-pressed={field.state === "confirmed"}
            onClick={() => onChange(markMatches(field))}
          >
            <CheckIcon aria-hidden className="hidden sm:block" /> {words.matches}
          </Button>
          <Button
            type="button"
            variant={field.state === "edited" ? "default" : "outline"}
            className={DECISION_BUTTON}
            onClick={startEdit}
          >
            <PencilIcon aria-hidden className="hidden sm:block" /> {words.change}
          </Button>
          <Button
            type="button"
            variant={field.state === "unknown" ? "secondary" : "outline"}
            className={DECISION_BUTTON}
            aria-pressed={field.state === "unknown"}
            onClick={() => onChange(markUnknown(field))}
          >
            <CircleHelpIcon aria-hidden className="hidden sm:block" /> {words.unknown}
          </Button>
        </div>
      )}
    </div>
  );
}
