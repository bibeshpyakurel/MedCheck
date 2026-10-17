"use client";

import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { CameraOffIcon, ImageIcon, KeyboardIcon } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ndcLookupKeys } from "@/lib/ndc";

type CameraState = "starting" | "scanning" | "denied" | "unavailable";

function createReader() {
  const hints = new Map<DecodeHintType, unknown>([
    [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.UPC_A, BarcodeFormat.EAN_13, BarcodeFormat.DATA_MATRIX, BarcodeFormat.CODE_128]],
  ]);
  return new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 150 });
}

/**
 * Reads a drug barcode with the rear camera (UPC-A, GS1 DataMatrix). Falls back to a photo of the
 * barcode or a typed NDC when the camera is blocked or missing. Stops the camera on unmount.
 */
export function BarcodeScanner({ onDetected, initialCode = "" }: { onDetected: (text: string) => void; initialCode?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onDetectedRef = useRef(onDetected);
  const [camera, setCamera] = useState<CameraState>("starting");
  const [manual, setManual] = useState(initialCode);
  const [manualError, setManualError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const inputId = useId();

  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    let controls: IScannerControls | null = null;
    let cancelled = false;
    let done = false;
    const video = videoRef.current;

    if (!video || !navigator.mediaDevices?.getUserMedia) {
      // Effects may set state; this runs once when the browser has no camera API (or no HTTPS).
      queueMicrotask(() => setCamera("unavailable"));
      return;
    }

    createReader()
      .decodeFromConstraints({ audio: false, video: { facingMode: { ideal: "environment" } } }, video, (result) => {
        if (!result || done) return;
        done = true;
        controls?.stop();
        onDetectedRef.current(result.getText());
      })
      .then((c) => {
        controls = c;
        if (cancelled || done) c.stop();
        else setCamera("scanning");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const name = error instanceof DOMException ? error.name : "";
        setCamera(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unavailable");
      });

    return () => {
      cancelled = true;
      controls?.stop();
    };
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
              Take a photo of the barcode instead, or type the NDC printed on the box.
              {camera === "denied" && " To scan live, allow camera access in your browser settings and reload."}
            </p>
          </div>
        </div>
      ) : (
        <div className="relative mx-auto aspect-[4/3] w-full max-w-md overflow-hidden rounded-2xl border bg-black shadow-lg">
          <video ref={videoRef} className="size-full object-cover" playsInline muted autoPlay aria-label="Camera preview" />
          <div aria-hidden className="pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-xl border-2 border-white/80 shadow-[0_0_0_9999px_rgb(0_0_0/0.35)]" />
          <p className="absolute inset-x-0 bottom-0 bg-black/60 px-3 py-2.5 text-center text-sm font-medium text-white backdrop-blur" aria-live="polite">
            {camera === "starting" ? "Starting camera…" : "Point the camera at the barcode on the box"}
          </p>
        </div>
      )}

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
          The NDC (National Drug Code) is the product number printed on the box, like{" "}
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
