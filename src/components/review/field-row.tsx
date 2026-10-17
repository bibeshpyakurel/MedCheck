"use client";

import { CheckIcon, CircleHelpIcon, PencilIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { Field, FieldState } from "@/lib/domain/schema";
import { cn } from "@/lib/utils";
import { EvidenceCrop } from "./evidence-crop";
import { applyEdit, markMatches, markUnknown } from "./field-actions";

const STATE_STYLE: Record<FieldState, string> = {
  pending: "bg-unresolved-surface text-unresolved-foreground ring-unresolved/35",
  confirmed: "bg-accent text-accent-foreground ring-primary/20",
  edited: "bg-accent text-accent-foreground ring-primary/20",
  unknown: "bg-muted text-muted-foreground ring-border",
};

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

  function startEdit() {
    setDraft(field.value ?? field.aiValue);
    setEditing(true);
  }

  return (
    <div
      className={cn(
        "space-y-4 rounded-2xl border bg-card p-4 shadow-xs transition-[border-color,box-shadow] sm:p-5",
        field.state === "pending" ? "border-unresolved/30" : "border-border",
      )}
      data-state={field.state}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-medium text-muted-foreground">{label}</h3>
        <div className="flex items-center gap-2">
          {actions}
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
              STATE_STYLE[field.state],
            )}
          >
            {field.state === "confirmed" || field.state === "edited" ? (
              <CheckIcon aria-hidden className="size-3" />
            ) : (
              <span aria-hidden className={cn("size-1.5 rounded-full bg-current", field.state === "unknown" && "opacity-50")} />
            )}
            {STATE_LABEL[field.state]}
          </span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,14rem)_1fr] sm:items-start">
        <EvidenceCrop evidence={field.evidence} photoUrl={photoUrl} />
        <div className="min-w-0">
          {field.value !== null ? (
            <p className="text-lg font-semibold break-words nums">{format(field.value)}</p>
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
        <div className="space-y-3 rounded-xl bg-surface p-3 ring-1 ring-border">
          {editor(draft, setDraft)}
          <div className="flex gap-2">
            <Button
              type="button"
              className="h-11 flex-1"
              onClick={() => {
                onChange(applyEdit(field, draft));
                setEditing(false);
              }}
            >
              Save
            </Button>
            <Button type="button" variant="ghost" className="h-11" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 border-t pt-4" role="group" aria-label={`Review ${label}`}>
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
