// The vitals scan's moment-to-moment rules: the countdown, the face hint and why a scan couldn't
// start. Pure; the camera and VitalLens itself live in components/vitals/vitals-scan.tsx.

/** How long the camera watches. VitalLens needs 5 s of face for heart rate and 10 s for breathing. */
export const SCAN_MS = 30_000;

/** The face confidence VitalLens's own widgets treat as "a face is in view". */
const FACE_CONFIDENCE_THRESHOLD = 0.5;

export function scanProgress(elapsedMs: number): { fraction: number; secondsLeft: number; done: boolean } {
  const elapsed = Math.min(SCAN_MS, Math.max(0, elapsedMs));
  return { fraction: elapsed / SCAN_MS, secondsLeft: Math.ceil((SCAN_MS - elapsed) / 1000), done: elapsed >= SCAN_MS };
}

/** `face.confidence` of a live result (one number, or one per frame: the newest); null before any. */
export function faceConfidence(result: unknown): number | null {
  const c = (result as { face?: { confidence?: unknown } } | null)?.face?.confidence;
  const latest = Array.isArray(c) ? c.at(-1) : c;
  return typeof latest === "number" && Number.isFinite(latest) ? latest : null;
}

export function faceInView(faceConfidence: number | null): boolean {
  return faceConfidence !== null && faceConfidence >= FACE_CONFIDENCE_THRESHOLD;
}

export function scanHint(faceConfidence: number | null): string {
  if (faceConfidence === null) return "Finding your face…";
  return faceInView(faceConfidence) ? "Hold still" : "Keep your face inside the oval";
}

/**
 * Why VitalLens couldn't start, from its error: the proxy's 503 (no key on this site), a key it
 * refused, a used-up free plan, or anything else (the connection). The library wraps the HTTP
 * status into the message ("… Status 429 - …") or throws a named error.
 */
export function scanFailureMessage(error: unknown): string {
  const name = error instanceof Error ? error.name : "";
  const status = Number((error instanceof Error ? error.message : "").match(/Status (\d{3})/)?.[1] ?? 0);
  if (status === 503) return "Vitals aren't set up on this site yet. Your medicines are saved.";
  if (status === 401 || status === 403 || name === "VitalLensAPIKeyError") {
    return "VitalLens didn't accept this site's key, so the scan can't run right now. Your medicines are saved.";
  }
  if (status === 429 || name === "VitalLensAPIQuotaExceededError") {
    return "This site's free VitalLens scans are used up for now. Try again later. Your medicines are saved.";
  }
  return "We couldn't reach VitalLens. Check your connection and try again.";
}
