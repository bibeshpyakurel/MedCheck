"use client";

import type { PhotoSource } from "@/components/capture/capture-options";
import { PhotoCapture, type PhotoAction } from "@/components/capture/photo-capture";

/** The photo step: no questions first. Gemini says what the photo shows while it reads it. */
export function PhotoForm({
  patientId,
  action,
  discardAction,
  otherWaysHref,
  source,
}: {
  patientId: string;
  action: PhotoAction;
  discardAction: (input: { patientId: string; entryIds: string[] }) => Promise<void>;
  otherWaysHref: string;
  source?: PhotoSource;
}) {
  return (
    <PhotoCapture
      patientId={patientId}
      action={action}
      discardAction={(entryIds) => discardAction({ patientId, entryIds })}
      otherWaysHref={otherWaysHref}
      source={source}
    >
      <input type="hidden" name="patientId" value={patientId} />
    </PhotoCapture>
  );
}
