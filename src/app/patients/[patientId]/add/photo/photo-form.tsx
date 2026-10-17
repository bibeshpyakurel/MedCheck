"use client";

import { useState } from "react";
import { PhotoCapture, type PhotoAction } from "@/components/capture/photo-capture";
import { cn } from "@/lib/utils";

export type PhotoKind = "prescription_label" | "discharge_list" | "otc_package" | "drug_facts_photo";

const KINDS: { value: PhotoKind; title: string; detail: string }[] = [
  { value: "prescription_label", title: "Prescription label", detail: "The sticker the pharmacy puts on a bottle." },
  {
    value: "discharge_list",
    title: "Discharge list",
    detail: "The medicine list a hospital or clinic gives you when you leave. It can include several medicines.",
  },
  {
    value: "otc_package",
    title: "Medicine box or bottle",
    detail: "A store-bought package, or its Drug Facts panel — the box listing ingredients and directions.",
  },
];

export function PhotoForm({
  patientId,
  initialKind,
  formulationId,
  action,
  otherWaysHref,
}: {
  patientId: string;
  initialKind: PhotoKind;
  /** Set on the barcode path: the photo is the Drug Facts panel of this catalog product. */
  formulationId: string | null;
  action: PhotoAction;
  otherWaysHref: string;
}) {
  const [kind, setKind] = useState<PhotoKind>(initialKind);
  // Both package kinds share one option; keep a Drug Facts kind passed in the URL.
  const kinds = KINDS.map((k) =>
    k.value === "otc_package" && initialKind === "drug_facts_photo" ? { ...k, value: initialKind } : k,
  );

  return (
    <PhotoCapture action={action} submitLabel="Read this photo" otherWaysHref={otherWaysHref}>
      <input type="hidden" name="patientId" value={patientId} />
      {formulationId && <input type="hidden" name="formulationId" value={formulationId} />}
      {formulationId ? (
        <input type="hidden" name="kind" value="drug_facts_photo" />
      ) : (
        <fieldset className="space-y-2">
          <legend className="mb-3 text-base font-semibold">What are you photographing?</legend>
          {kinds.map((k) => (
            <label
              key={k.value}
              className={cn(
                "flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border p-4 shadow-xs transition-[border-color,background-color] has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                kind === k.value ? "border-primary bg-accent ring-1 ring-primary/30" : "bg-card hover:border-input hover:bg-muted/40",
              )}
            >
              <input
                type="radio"
                name="kind"
                value={k.value}
                checked={kind === k.value}
                onChange={() => setKind(k.value)}
                className="mt-1 size-5 accent-primary"
              />
              <span>
                <span className="block font-medium">{k.title}</span>
                <span className="block text-sm text-muted-foreground">{k.detail}</span>
              </span>
            </label>
          ))}
        </fieldset>
      )}
    </PhotoCapture>
  );
}
