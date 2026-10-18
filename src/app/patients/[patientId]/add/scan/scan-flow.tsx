"use client";

import { CameraIcon, CheckIcon, RotateCcwIcon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { BarcodeScanner } from "@/components/capture/barcode-scanner";
import { Button } from "@/components/ui/button";
import { matchOptionLabel, type MatchOption } from "@/lib/photo-flow";
import { confirmScanAction, lookupScanAction } from "./actions";

type State =
  | { step: "scanning" }
  | { step: "looking-up"; code: string }
  | { step: "found"; code: string; option: MatchOption }
  | { step: "not-found"; code: string }
  | { step: "error"; code: string };

/** Scan (or type) → look up → "Is this the medicine?" with the one label the code belongs to → Confirm. */
export function ScanFlow({ patientId }: { patientId: string }) {
  const [state, setState] = useState<State>({ step: "scanning" });
  // The last code tried stays in the typed-number box, so a mistyped number can be fixed rather than retyped.
  const [lastCode, setLastCode] = useState("");
  const [saving, startSaving] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);

  async function lookUp(code: string) {
    setLastCode(code);
    setState({ step: "looking-up", code });
    const result = await lookupScanAction(code).catch(() => ({ status: "error" }) as const);
    setState(result.status === "found" ? { step: "found", code, option: result.option } : { step: result.status, code });
  }

  function confirm(formulationId: string) {
    setSaveError(null);
    startSaving(async () => {
      const result = await confirmScanAction({ patientId, formulationId });
      if (result?.error) setSaveError(result.error);
    });
  }

  const scanAgain = (
    <Button variant="ghost" className="h-11 w-full text-base" disabled={saving} onClick={() => setState({ step: "scanning" })}>
      <RotateCcwIcon aria-hidden /> Scan or type a different number
    </Button>
  );
  const takePhoto = (
    <Button
      variant="outline"
      className="h-11 w-full text-base"
      nativeButton={false}
      render={<Link href={`/patients/${patientId}/add/photo?source=camera`} replace />}
    >
      <CameraIcon aria-hidden /> Take a photo of the package instead
    </Button>
  );

  if (state.step === "scanning") return <BarcodeScanner initialCode={lastCode} onDetected={(code) => void lookUp(code)} />;

  if (state.step === "looking-up") {
    return (
      <p role="status" className="flex items-center gap-3 rounded-2xl border bg-card p-5 text-muted-foreground shadow-xs">
        <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
        <span>
          Looking up <span className="font-mono text-foreground">{state.code}</span>…
        </span>
      </p>
    );
  }

  if (state.step === "found") {
    const { option } = state;
    const meta = [option.dosageForm.toLowerCase(), option.labelerName].filter(Boolean).join(" · ");
    return (
      <div className="space-y-5">
        <section aria-label={matchOptionLabel(option)} className="space-y-3 rounded-2xl border border-primary bg-accent p-5 shadow-sm ring-1 ring-primary/30">
          <h2 className="font-display text-xl font-semibold tracking-tight">Is this the medicine?</h2>
          <div className="space-y-1">
            <p className="font-semibold text-pretty">{option.brandName}</p>
            {option.ingredients.map((i) => (
              <p key={`${i.name}-${i.strength}`} className="text-sm nums">
                {i.name} {i.strength}
              </p>
            ))}
            {meta && <p className="text-sm text-muted-foreground">{meta}</p>}
            <p className="text-sm font-medium text-primary">
              Matches barcode <span className="font-mono">{state.code}</span>
            </p>
          </div>
        </section>
        <div className="space-y-2.5">
          <Button className="h-12 w-full text-base" disabled={saving} onClick={() => confirm(option.id)}>
            <CheckIcon aria-hidden /> {saving ? "Saving…" : "Confirm"}
          </Button>
          {saveError && (
            <p role="alert" className="text-sm text-destructive">
              {saveError}
            </p>
          )}
          {scanAgain}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div role="status" className="rounded-2xl border bg-card p-5 shadow-xs">
        <p className="font-medium">{state.step === "not-found" ? "Not in the FDA list" : "Couldn't look that up right now"}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {state.step === "not-found" ? "No FDA label matches " : "The lookup didn't finish for "}
          <span className="font-mono text-foreground">{state.code}</span>. Store brands often print their own barcode;
          a photo of the package works for those.
        </p>
      </div>
      {state.step === "error" && (
        <Button variant="outline" className="h-11 w-full text-base" onClick={() => void lookUp(state.code)}>
          <RotateCcwIcon aria-hidden /> Try again
        </Button>
      )}
      {takePhoto}
      {scanAgain}
    </div>
  );
}
