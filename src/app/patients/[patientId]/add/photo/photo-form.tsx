"use client";

import { useState } from "react";
import type { PhotoSource } from "@/components/capture/capture-options";
import { PhotoCapture, type PhotoAction } from "@/components/capture/photo-capture";
import { cn } from "@/lib/utils";

export type PhotoKind = "prescription_label" | "discharge_list" | "otc_package";

const KINDS: { value: PhotoKind; title: string; detail: string }[] = [
  { value: "prescription_label", title: "Prescription label", detail: "The sticker the pharmacy puts on the container." },
  {
    value: "discharge_list",
    title: "Discharge list",
    detail: "The medicine list a hospital or clinic gives you when you leave. It can include several medicines.",
  },
  {
    value: "otc_package",
    title: "Medicine package",
    detail: "A store-bought medicine. Photograph the front of the package; MedCheck finds it in the FDA list.",
  },
];

export function PhotoForm({
  patientId,
  initialKind,
  action,
  otherWaysHref,
  source,
}: {
  patientId: string;
  initialKind: PhotoKind;
  action: PhotoAction;
  otherWaysHref: string;
  source?: PhotoSource;
}) {
  const [kind, setKind] = useState<PhotoKind>(initialKind);

  return (
    <PhotoCapture action={action} submitLabel="Read this photo" otherWaysHref={otherWaysHref} source={source}>
      <input type="hidden" name="patientId" value={patientId} />
      <fieldset className="space-y-2">
        <legend className="mb-3 text-base font-semibold">What is this a photo of?</legend>
        {KINDS.map((k) => (
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
    </PhotoCapture>
  );
}
