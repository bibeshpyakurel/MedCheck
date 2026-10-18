"use client";

// "Compare with my medicines" on a medicine card. Shown only when the person has another medicine on
// file to compare with (its list loads when the card opens).
import { GitCompareArrowsIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { compareChoicesAction, type CompareChoices } from "@/app/patients/[patientId]/compare-actions";
import { CompareSheet } from "@/components/compare/compare-sheet";
import { Button } from "@/components/ui/button";
import type { CompareSubject } from "@/lib/compare-view";

export function CompareButton({ patientId, subject }: { patientId: string; subject: CompareSubject }) {
  const [choices, setChoices] = useState<CompareChoices | null>(null);
  const [open, setOpen] = useState(false);
  const { entryId, formulationId } = subject;

  useEffect(() => {
    let live = true;
    compareChoicesAction({ patientId, subject: { entryId, formulationId } })
      .then((r) => {
        if (live && !("error" in r)) setChoices(r);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [patientId, entryId, formulationId]);

  if (!choices || choices.options.length === 0) return null;
  return (
    <>
      <Button className="h-11 w-full px-4 text-base sm:w-auto" onClick={() => setOpen(true)}>
        <GitCompareArrowsIcon aria-hidden /> Compare with my medicines
      </Button>
      <CompareSheet patientId={patientId} subject={{ entryId, formulationId }} choices={choices} open={open} onOpenChange={setOpen} />
    </>
  );
}
