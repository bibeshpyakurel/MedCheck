"use client";

import { CheckIcon, CircleHelpIcon, PencilIcon } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { Field, FieldState } from "@/lib/domain/schema";
import { cn } from "@/lib/utils";
import { ShowEditorErrors } from "./editors";
import { EvidenceCrop } from "./evidence-crop";
import { applyEdit, markMatches, markUnknown } from "./field-actions";

const STATE_LABEL: Record<FieldState, string> = {
  pending: "Check this",
  confirmed: "Matches",
  edited: "Edited",
  unknown: "Can't tell",
};

/**
 * One reviewed value: where it came from | the value | Matches / Edit / Can't tell
 * (→ confirmed / edited / unknown). `editor` renders the input while editing.
 */
export function FieldRow<T>({
  label,
  field,
  onChange,
  format,
  editor,
  photoUrl,
  actions,
}: {
  label: string;
  field: Field<T>;
  onChange: (field: Field<T>) => void;
  format: (value: T) => string;
  editor: (value: T | null, setValue: (value: T | null) => void) => ReactNode;
  photoUrl: string | null;
  actions?: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<T | null>(null);
  // Save attempts with an invalid value: the editor shows its errors and we focus the first one.
  const [rejectedSaves, setRejectedSaves] = useState(0);
  const editorRef = useRef<HTMLDivElement>(null);

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
    // An empty or invalid value never becomes "Can't tell" — only that button does.
    if (draft === null) return setRejectedSaves((n) => n + 1);
    onChange(applyEdit(field, draft));
    setEditing(false);
  }

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4" data-state={field.state}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-medium text-muted-foreground">{label}</h3>
        <div className="flex items-center gap-2">
          {actions}
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium",
              field.state === "pending"
                ? "bg-unresolved-surface text-unresolved-foreground"
                : "bg-muted text-muted-foreground",
            )}
          >
            {STATE_LABEL[field.state]}
          </span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,14rem)_1fr] sm:items-start">
        <EvidenceCrop evidence={field.evidence} photoUrl={photoUrl} />
        <div className="min-w-0">
          {field.value !== null ? (
            <p className="text-lg font-medium break-words">{format(field.value)}</p>
          ) : (
            <p className="text-base text-muted-foreground">
              {field.state === "unknown" && field.aiValue === null ? "Not found — tap Edit to type it" : "No value"}
            </p>
          )}
          {field.state === "edited" && field.aiValue !== null && (
            <p className="mt-1 text-sm text-muted-foreground">MedCheck read: {format(field.aiValue)}</p>
          )}
        </div>
      </div>

      {editing ? (
        <div ref={editorRef} className="space-y-3">
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
            variant={field.state === "confirmed" || field.state === "edited" ? "default" : "outline"}
            className="h-11"
            disabled={field.value === null}
            aria-pressed={field.state === "confirmed"}
            onClick={() => onChange(markMatches(field))}
          >
            <CheckIcon aria-hidden /> Matches
          </Button>
          <Button type="button" variant="outline" className="h-11" onClick={startEdit}>
            <PencilIcon aria-hidden /> Edit
          </Button>
          <Button
            type="button"
            variant={field.state === "unknown" ? "secondary" : "outline"}
            className="h-11"
            aria-pressed={field.state === "unknown"}
            onClick={() => onChange(markUnknown(field))}
          >
            <CircleHelpIcon aria-hidden /> Can&apos;t tell
          </Button>
        </div>
      )}
    </div>
  );
}
