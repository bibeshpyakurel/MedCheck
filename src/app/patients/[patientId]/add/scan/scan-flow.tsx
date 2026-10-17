"use client";

import { CameraIcon, ListIcon, RotateCcwIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { BarcodeScanner } from "@/components/capture/barcode-scanner";
import { FormulationSummary } from "@/components/catalog/formulation-summary";
import { Button } from "@/components/ui/button";
import type { Formulation } from "@/lib/domain/schema";
import { addFromCatalog } from "../catalog-actions";

type State =
  | { step: "scanning" }
  | { step: "looking-up"; code: string }
  | { step: "found"; formulation: Formulation }
  | { step: "not-found"; code: string }
  | { step: "error"; code: string };

export function ScanFlow({ patientId }: { patientId: string }) {
  const [state, setState] = useState<State>({ step: "scanning" });
  const base = `/patients/${patientId}/add`;

  async function lookUp(code: string) {
    setState({ step: "looking-up", code });
    try {
      const res = await fetch(`/api/ndc/${encodeURIComponent(code)}`);
      if (res.status === 404) return setState({ step: "not-found", code });
      if (!res.ok) return setState({ step: "error", code });
      const { formulation } = (await res.json()) as { formulation: Formulation };
      setState({ step: "found", formulation });
    } catch {
      setState({ step: "error", code });
    }
  }

  const scanAgain = (
    <Button variant="ghost" className="h-11 w-full text-base" onClick={() => setState({ step: "scanning" })}>
      <RotateCcwIcon aria-hidden /> Scan a different barcode
    </Button>
  );

  if (state.step === "scanning") return <BarcodeScanner onDetected={lookUp} />;

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
    const f = state.formulation;
    return (
      <div className="space-y-5">
        <section aria-labelledby="db-label" className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
          <p id="db-label" className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground ring-1 ring-primary/15">
            Found in the database
          </p>
          <FormulationSummary formulation={f} />
          {f.directionsText && (
            <div className="space-y-1 border-t pt-4 text-sm">
              <p className="font-medium">Directions on the label</p>
              <p className="text-muted-foreground">{f.directionsText}</p>
            </div>
          )}
          {f.max24hText && (
            <p className="text-sm">
              <span className="font-medium">24-hour maximum on the label:</span> “{f.max24hText}”
            </p>
          )}
        </section>

        <div className="space-y-2.5">
          <p className="rounded-xl bg-surface p-3 text-sm text-muted-foreground ring-1 ring-border">
            Database labels can differ from the box in your hand. Photograph the Drug Facts panel so MedCheck can
            compare them.
          </p>
          <Button
            className="h-11 w-full text-base"
            nativeButton={false}
            render={<Link href={`${base}/photo?kind=drug_facts_photo&formulationId=${f.id}&method=barcode`} />}
          >
            <CameraIcon aria-hidden /> Photograph the Drug Facts panel
          </Button>
          <form action={addFromCatalog}>
            <input type="hidden" name="patientId" value={patientId} />
            <input type="hidden" name="formulationId" value={f.id} />
            <input type="hidden" name="method" value="barcode" />
            <Button type="submit" variant="outline" className="h-11 w-full text-base">
              Skip photo — review the database label
            </Button>
          </form>
          {scanAgain}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div role="status" className="rounded-2xl border bg-card p-5 shadow-xs">
        <p className="font-medium">
          {state.step === "not-found" ? "Not in our supported list" : "Couldn't look that up right now"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {state.step === "not-found"
            ? "We couldn't find a label for "
            : "The lookup didn't finish for "}
          <span className="font-mono text-foreground">{state.code}</span>. You can photograph the label instead.
        </p>
      </div>
      {state.step === "error" && (
        <Button variant="outline" className="h-11 w-full text-base" onClick={() => lookUp(state.code)}>
          <RotateCcwIcon aria-hidden /> Try the lookup again
        </Button>
      )}
      <Button
        className="h-11 w-full text-base"
        nativeButton={false}
        render={<Link href={`${base}/photo?kind=drug_facts_photo`} />}
      >
        <CameraIcon aria-hidden /> Photograph the label
      </Button>
      <Button variant="outline" className="h-11 w-full text-base" nativeButton={false} render={<Link href={`${base}/pick`} />}>
        <ListIcon aria-hidden /> Pick from the supported list
      </Button>
      {scanAgain}
    </div>
  );
}
