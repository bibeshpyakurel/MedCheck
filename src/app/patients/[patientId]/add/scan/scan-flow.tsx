"use client";

import { CameraIcon, LoaderCircleIcon, RotateCcwIcon, ScanBarcodeIcon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { BarcodeScanner, CodeEntry } from "@/components/capture/barcode-scanner";
import { MedicineCard } from "@/components/medicine-card/medicine-card";
import { Button } from "@/components/ui/button";
import type { CameraProblem } from "@/lib/barcode-scan";
import type { Formulation } from "@/lib/domain/schema";
import { confirmScanAction, lookupScanAction } from "./actions";

type State =
  | { step: "camera" }
  | { step: "camera-closed"; problem: CameraProblem | null; typing: boolean }
  | { step: "looking-up"; code: string; fromCamera: boolean }
  | { step: "found"; code: string; formulation: Formulation }
  | { step: "not-found"; code: string }
  | { step: "error"; code: string };

/**
 * The scanner opens at once; a barcode in view (or a typed number) → its one FDA label → straight to
 * that medicine's card, as for one medicine in a photo. Save to My medicines, or scan another.
 */
export function ScanFlow({ patientId }: { patientId: string }) {
  const [state, setState] = useState<State>({ step: "camera" });
  // The last code tried stays in the typed-number box, so a mistyped number can be fixed rather than retyped.
  const [lastCode, setLastCode] = useState("");
  const [saving, startSaving] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);

  async function lookUp(code: string, fromCamera: boolean) {
    setLastCode(code);
    setSaveError(null);
    setState({ step: "looking-up", code, fromCamera });
    const result = await lookupScanAction(code).catch(() => ({ status: "error" }) as const);
    setState(result.status === "found" ? { step: "found", code, formulation: result.formulation } : { step: result.status, code });
  }

  function save(formulationId: string) {
    setSaveError(null);
    startSaving(async () => {
      const result = await confirmScanAction({ patientId, formulationId });
      if (result?.error) setSaveError(result.error);
    });
  }

  const scan = () => setState({ step: "camera" });
  // The scanner stays up, showing "Got it", while a code it read is looked up.
  const scannerOpen = state.step === "camera" || (state.step === "looking-up" && state.fromCamera);

  let body;
  if (state.step === "found") {
    const { formulation } = state;
    body = (
      <MedicineCard
        formulation={formulation}
        showTitle={false}
        actions={
          <div className="space-y-3">
            <p className="text-sm font-medium text-primary">
              Matches barcode <span className="font-mono">{state.code}</span>
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button className="h-11 text-base sm:flex-1" disabled={saving} onClick={() => save(formulation.id)}>
                {saving ? (
                  <>
                    <LoaderCircleIcon aria-hidden className="animate-spin" /> Saving…
                  </>
                ) : (
                  "Save to My medicines"
                )}
              </Button>
              <Button variant="outline" className="h-11 text-base sm:flex-1" disabled={saving} onClick={scan}>
                <ScanBarcodeIcon aria-hidden /> Scan another
              </Button>
            </div>
            {saveError ? (
              <p role="alert" className="text-sm text-destructive">
                {saveError}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Nothing is saved yet.</p>
            )}
          </div>
        }
      />
    );
  } else if (state.step === "looking-up") {
    body = (
      <p role="status" className="flex items-center gap-3 rounded-2xl border bg-card p-5 text-muted-foreground shadow-xs">
        <LoaderCircleIcon aria-hidden className="size-4 animate-spin text-primary" />
        <span>
          Looking up <span className="font-mono text-foreground">{state.code}</span>…
        </span>
      </p>
    );
  } else if (state.step === "not-found" || state.step === "error") {
    const { code } = state;
    body = (
      <div className="space-y-4">
        <div role="status" className="rounded-2xl border bg-card p-5 shadow-xs">
          <p className="font-medium">{state.step === "not-found" ? "Not in the FDA list" : "Couldn't look that up right now"}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {state.step === "not-found" ? "No FDA label matches " : "The lookup didn't finish for "}
            <span className="font-mono text-foreground">{code}</span>. Store brands often print their own barcode;
            a photo of the package works for those.
          </p>
        </div>
        {state.step === "error" && (
          <Button variant="outline" className="h-11 w-full text-base" onClick={() => void lookUp(code, false)}>
            <RotateCcwIcon aria-hidden /> Try again
          </Button>
        )}
        <Button
          variant="outline"
          className="h-11 w-full text-base"
          nativeButton={false}
          render={<Link href={`/patients/${patientId}/add/photo?source=camera`} replace />}
        >
          <CameraIcon aria-hidden /> Take a photo of the package instead
        </Button>
        <Button variant="ghost" className="h-11 w-full text-base" onClick={scan}>
          <ScanBarcodeIcon aria-hidden /> Scan or type a different number
        </Button>
      </div>
    );
  } else {
    // Under the open scanner, or after it was closed: open it again, or type the number.
    const closed = state.step === "camera-closed" ? state : null;
    body = (
      <CodeEntry
        key={closed?.typing ? "typing" : "entry"}
        initialCode={lastCode}
        problem={closed?.problem ?? null}
        focusInput={closed?.typing ?? false}
        onScan={scan}
        onDetected={(code) => void lookUp(code, false)}
      />
    );
  }

  return (
    <>
      {state.step === "found" ? (
        <h1 className="font-display text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{state.formulation.brandName}</h1>
      ) : (
        <header className="space-y-2">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-balance sm:text-3xl">Scan a barcode</h1>
          <p className="leading-relaxed text-muted-foreground text-pretty">
            Hold the barcode on the medicine package up to the camera. MedCheck finds the label the FDA has on file for it.
          </p>
        </header>
      )}
      {body}
      {scannerOpen && (
        <BarcodeScanner
          onDetected={(code) => void lookUp(code, true)}
          onProblem={(problem) => setState({ step: "camera-closed", problem, typing: false })}
          onClose={() => setState({ step: "camera-closed", problem: null, typing: false })}
          onType={() => setState({ step: "camera-closed", problem: null, typing: true })}
        />
      )}
    </>
  );
}
