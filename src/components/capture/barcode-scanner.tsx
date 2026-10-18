"use client";

import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { CameraOffIcon, ImageIcon, KeyboardIcon } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { nativeScanFormats, SCAN_INTERVAL_MS, scanVideoConstraints } from "@/lib/barcode-scan";
import { ndcLookupKeys } from "@/lib/ndc";
import { cn } from "@/lib/utils";

type CameraState = "starting" | "scanning" | "denied" | "unavailable";

function createReader() {
  const hints = new Map<DecodeHintType, unknown>([
    [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.UPC_A, BarcodeFormat.EAN_13, BarcodeFormat.DATA_MATRIX, BarcodeFormat.CODE_128]],
    [DecodeHintType.TRY_HARDER, true],
  ]);
  return new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: SCAN_INTERVAL_MS });
}

/** The native barcode reader (Chrome on Android and macOS): not in TypeScript's DOM types yet. */
type NativeDetector = { detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]> };
type NativeDetectorClass = {
  new (options: { formats: string[] }): NativeDetector;
  getSupportedFormats(): Promise<string[]>;
};

/** The device's own barcode reader when it handles drug-package formats; null means use ZXing. */
async function nativeDetector(): Promise<NativeDetector | null> {
  const Detector = (window as unknown as { BarcodeDetector?: NativeDetectorClass }).BarcodeDetector;
  if (!Detector) return null;
  try {
    const formats = nativeScanFormats(await Detector.getSupportedFormats());
    return formats.length > 0 ? new Detector({ formats }) : null;
  } catch {
    return null;
  }
}

/** Keep refocusing as the package moves closer, where the browser allows it (Chrome on Android). */
async function focusContinuously(stream: MediaStream) {
  const [track] = stream.getVideoTracks();
  const focusModes = (track?.getCapabilities?.() as { focusMode?: string[] } | undefined)?.focusMode;
  if (!track || !focusModes?.includes("continuous")) return;
  await track.applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] }).catch(() => {});
}

/**
 * Reads a drug barcode live with the rear camera (UPC-A, EAN-13, GS1 DataMatrix, Code 128): hold
 * the package up and it's picked up on its own, no button. The device's own reader is used where
 * there is one (fast, native), else ZXing. An HD stream with continuous focus keeps small barcodes
 * sharp up close. A hit buzzes (where phones can) and flashes the frame. A photo of the barcode is
 * offered only when the camera is blocked or missing; a typed NDC always works. Stops the camera on
 * unmount.
 */
export function BarcodeScanner({ onDetected, initialCode = "" }: { onDetected: (text: string) => void; initialCode?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onDetectedRef = useRef(onDetected);
  const [camera, setCamera] = useState<CameraState>("starting");
  const [found, setFound] = useState(false);
  const [manual, setManual] = useState(initialCode);
  const [manualError, setManualError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const inputId = useId();

  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let controls: IScannerControls | null = null;
    let timer = 0;
    let stopped = false;
    const video = videoRef.current;

    if (!video || !navigator.mediaDevices?.getUserMedia) {
      // Effects may set state; this runs once when the browser has no camera API (or no HTTPS).
      queueMicrotask(() => setCamera("unavailable"));
      return;
    }

    function stop() {
      stopped = true;
      window.clearTimeout(timer);
      controls?.stop();
      stream?.getTracks().forEach((track) => track.stop());
    }

    function detected(text: string) {
      if (stopped) return;
      stop();
      navigator.vibrate?.(60);
      setFound(true);
      onDetectedRef.current(text);
    }

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: scanVideoConstraints() });
      } catch (error) {
        if (stopped) return;
        const name = error instanceof DOMException ? error.name : "";
        setCamera(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unavailable");
        return;
      }
      if (stopped || !video) return stream.getTracks().forEach((track) => track.stop());
      void focusContinuously(stream);

      const detector = await nativeDetector();
      if (stopped) return;
      if (detector) {
        video.srcObject = stream;
        await video.play().catch(() => {});
        setCamera("scanning");
        const scan = async () => {
          if (stopped) return;
          if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            const codes = await detector.detect(video).catch(() => []);
            if (codes[0]?.rawValue) return detected(codes[0].rawValue);
          }
          timer = window.setTimeout(scan, SCAN_INTERVAL_MS);
        };
        void scan();
        return;
      }

      controls = await createReader().decodeFromStream(stream, video, (result) => {
        if (result) detected(result.getText());
      });
      if (stopped) controls.stop();
      else setCamera("scanning");
    }

    void start();
    return stop;
  }, []);

  function submitManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!manual.trim()) {
      setManualError("Type the NDC or the number under the barcode first.");
      return;
    }
    if (!ndcLookupKeys(manual)) {
      setManualError("That doesn't look like an NDC (like 37000-523-02) or a 12-digit barcode number.");
      return;
    }
    setManualError(null);
    onDetected(manual.trim());
  }

  async function decodePhoto(file: File | undefined) {
    if (!file) return;
    setPhotoError(null);
    const url = URL.createObjectURL(file);
    try {
      const result = await createReader().decodeFromImageUrl(url);
      onDetected(result.getText());
    } catch {
      setPhotoError("Couldn't read a barcode in that photo. Try again closer and in good light, or type the NDC.");
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  const cameraBlocked = camera === "denied" || camera === "unavailable";

  return (
    <div className="space-y-6">
      {cameraBlocked ? (
        <div role="status" className="flex gap-3 rounded-2xl border bg-surface p-5">
          <CameraOffIcon aria-hidden className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <div className="space-y-1">
            <p className="font-medium">
              {camera === "denied" ? "Camera access was blocked." : "No camera is available here."}
            </p>
            <p className="text-sm text-muted-foreground">
              Take a photo of the barcode instead, or type the NDC printed on the package.
              {camera === "denied" && " To scan live, allow camera access in your browser settings and reload."}
            </p>
          </div>
        </div>
      ) : (
        <div className="relative mx-auto aspect-[4/3] w-full max-w-md overflow-hidden rounded-2xl border bg-black shadow-lg">
          <video ref={videoRef} className="size-full object-cover" playsInline muted autoPlay aria-label="Camera preview" />
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-xl border-2 shadow-[0_0_0_9999px_rgb(0_0_0/0.35)] transition-colors duration-150",
              found ? "border-primary bg-primary/25" : "border-white/80",
            )}
          >
            {camera === "scanning" && !found && (
              <span className="absolute inset-x-2 h-0.5 animate-scan rounded-full bg-primary/90 shadow-[0_0_10px_2px_color-mix(in_oklab,var(--primary)_55%,transparent)] motion-reduce:hidden" />
            )}
          </div>
          <p className="absolute inset-x-0 bottom-0 bg-black/60 px-3 py-2.5 text-center text-sm font-medium text-white backdrop-blur" aria-live="polite">
            {found ? "Got it" : camera === "starting" ? "Starting camera…" : "Hold the barcode inside the box. It scans by itself."}
          </p>
        </div>
      )}

      {/* Without a live camera, a photo of the barcode is the next quickest way. */}
      {cameraBlocked && (
        <div className="space-y-2">
          <Button
            variant="outline"
            className="h-11 w-full text-base"
            nativeButton={false}
            render={<label htmlFor={`${inputId}-photo`} />}
          >
            <ImageIcon aria-hidden /> Take a photo of the barcode
          </Button>
          <input
            id={`${inputId}-photo`}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => {
              void decodePhoto(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {photoError && <p className="text-sm text-destructive">{photoError}</p>}
        </div>
      )}

      <form onSubmit={submitManual} className="space-y-2 rounded-2xl border bg-card p-4 shadow-xs" noValidate>
        <Label htmlFor={`${inputId}-ndc`} className="flex items-center gap-2">
          <KeyboardIcon aria-hidden className="size-4" /> Or type the NDC or barcode number
        </Label>
        <div className="flex gap-2">
          <Input
            id={`${inputId}-ndc`}
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="NDC or barcode number"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            inputMode="text"
            className="h-11 text-base"
            aria-invalid={manualError ? true : undefined}
            aria-describedby={`${inputId}-ndc-hint${manualError ? ` ${inputId}-ndc-error` : ""}`}
          />
          <Button type="submit" className="h-11 px-4 text-base">
            Look up
          </Button>
        </div>
        <p id={`${inputId}-ndc-hint`} className="text-sm text-muted-foreground">
          The NDC (National Drug Code) is the product number printed on the package, like{" "}
          <span className="font-mono text-foreground">37000-523-02</span>. The barcode number is the row of digits under
          the bars, like <span className="font-mono text-foreground">3 37000 52302 5</span>.
        </p>
        {manualError && (
          <p id={`${inputId}-ndc-error`} className="text-sm text-destructive">
            {manualError}
          </p>
        )}
      </form>
    </div>
  );
}
