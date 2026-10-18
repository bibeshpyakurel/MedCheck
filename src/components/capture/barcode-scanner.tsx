"use client";

import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { CameraIcon, CameraOffIcon, ImageIcon, KeyboardIcon, XIcon } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBackToClose } from "@/components/use-back-to-close";
import { cameraProblem, nativeScanFormats, SCAN_INTERVAL_MS, scanVideoConstraints, type CameraProblem } from "@/lib/barcode-scan";
import { ndcLookupKeys } from "@/lib/ndc";
import { cn } from "@/lib/utils";

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

const errorName = (error: unknown) => (error instanceof Error ? error.name : "");

/** The rear camera at HD; a camera that turns that request down gets one plain request for any camera. */
async function openCamera(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: false, video: scanVideoConstraints() });
  } catch (error) {
    if (cameraProblem(errorName(error), true) === "denied") throw error;
    return navigator.mediaDevices.getUserMedia({ audio: false, video: true });
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
 * The full-screen live scanner, open from the moment the scan screen opens. It reads a drug barcode
 * (UPC-A, EAN-13, GS1 DataMatrix, Code 128) with the rear camera as soon as one is in view, no
 * button: the device's own reader where there is one, else ZXing; an HD stream with continuous
 * focus keeps small barcodes sharp up close. A hit buzzes (where phones can), flashes the box and
 * stays up while the parent looks the code up. A camera that can't start reports why
 * (`onProblem`); ×, Escape or device Back close it (`onClose`). Stops the camera on unmount.
 */
export function BarcodeScanner({
  onDetected,
  onProblem,
  onClose,
  onType,
}: {
  onDetected: (code: string) => void;
  onProblem: (problem: CameraProblem) => void;
  onClose: () => void;
  /** "Type the number instead": close, then focus the typed-number box. */
  onType: () => void;
}) {
  // The dialog mounts its content after this component does, so the camera starts once the video is there.
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hasVideo, setHasVideo] = useState(false);
  const setVideo = useCallback((element: HTMLVideoElement | null) => {
    videoRef.current = element;
    setHasVideo(element !== null);
  }, []);
  const [live, setLive] = useState(false);
  const [found, setFound] = useState(false);
  const handlers = useRef({ onDetected, onProblem });
  useEffect(() => {
    handlers.current = { onDetected, onProblem };
  }, [onDetected, onProblem]);
  useBackToClose(true, onClose);

  useEffect(() => {
    const video = videoRef.current;
    if (!hasVideo || !video) return;
    let stream: MediaStream | null = null;
    let controls: IScannerControls | null = null;
    let timer = 0;
    let stopped = false;

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
      handlers.current.onDetected(text);
    }

    async function start(video: HTMLVideoElement) {
      if (!navigator.mediaDevices?.getUserMedia) {
        // No camera API: an http:// page on a phone, or a browser without one.
        handlers.current.onProblem(cameraProblem("", window.isSecureContext));
        return;
      }
      try {
        stream = await openCamera();
      } catch (error) {
        if (!stopped) handlers.current.onProblem(cameraProblem(errorName(error), window.isSecureContext));
        return;
      }
      if (stopped) return stream.getTracks().forEach((track) => track.stop());
      void focusContinuously(stream);

      const detector = await nativeDetector();
      if (stopped) return;
      if (detector) {
        video.srcObject = stream;
        await video.play().catch(() => {});
        setLive(true);
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
      else setLive(true);
    }

    void start(video);
    return stop;
  }, [hasVideo]);

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="top-0 left-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none bg-black p-0 text-white ring-0 sm:max-w-none data-open:zoom-in-100"
      >
        <video ref={setVideo} className="absolute inset-0 size-full object-cover" playsInline muted autoPlay aria-label="Camera preview" />

        <div className="relative flex items-center gap-2 bg-gradient-to-b from-black/70 to-transparent px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-6">
          <DialogTitle className="flex-1 font-display text-lg font-semibold text-white">Scan a barcode</DialogTitle>
          <Button variant="ghost" size="icon" className="size-11 text-white hover:bg-white/15 hover:text-white" onClick={onClose}>
            <XIcon aria-hidden className="size-6" />
            <span className="sr-only">Close the scanner</span>
          </Button>
        </div>

        {/* The box to hold the barcode in; everything around it is dimmed. */}
        <div className="relative grid flex-1 place-items-center px-8">
          <div
            aria-hidden
            className={cn(
              "relative h-40 w-full max-w-sm rounded-2xl border-[3px] shadow-[0_0_0_9999px_rgb(0_0_0/0.45)] transition-colors duration-150",
              found ? "border-primary bg-primary/25" : "border-white/90",
            )}
          >
            {live && !found && (
              <span className="absolute inset-x-3 h-0.5 animate-scan rounded-full bg-primary shadow-[0_0_10px_2px_color-mix(in_oklab,var(--primary)_55%,transparent)] motion-reduce:hidden" />
            )}
          </div>
        </div>

        <div className="relative space-y-3 bg-gradient-to-t from-black/80 to-transparent px-4 pt-8 pb-[max(1rem,env(safe-area-inset-bottom))] text-center">
          <p role="status" className="text-base font-medium text-pretty">
            {found ? "Got it. Looking it up…" : live ? "Hold the barcode inside the box. It scans by itself." : "Starting the camera…"}
          </p>
          <Button
            variant="outline"
            className="h-11 border-white/40 bg-white/10 px-4 text-base text-white hover:bg-white/20 hover:text-white"
            disabled={found}
            onClick={onType}
          >
            <KeyboardIcon aria-hidden /> Type the number instead
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const PROBLEM_TEXT: Record<CameraProblem, { title: string; body: string }> = {
  denied: {
    title: "Camera access is blocked.",
    body: "To scan, allow the camera for this site in your browser settings, then try again.",
  },
  insecure: {
    title: "The camera needs a secure page.",
    body: "Browsers only open the camera on https:// pages. Open MedCheck at its https:// address to scan.",
  },
  unavailable: {
    title: "The camera didn't start.",
    body: "Another app may be using it. Close that app, then try again.",
  },
};

/**
 * Under the scanner: open it again, or (when the camera couldn't start) why, and a photo of the
 * barcode instead; a typed NDC or barcode number always works.
 */
export function CodeEntry({
  onDetected,
  onScan,
  problem,
  initialCode = "",
  focusInput = false,
}: {
  onDetected: (code: string) => void;
  /** Open the live scanner again. */
  onScan: () => void;
  problem: CameraProblem | null;
  initialCode?: string;
  focusInput?: boolean;
}) {
  const [manual, setManual] = useState(initialCode);
  const [manualError, setManualError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const inputId = useId();

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

  return (
    <div className="space-y-6">
      {problem ? (
        <div className="space-y-3">
          <div role="status" className="flex gap-3 rounded-2xl border bg-surface p-5">
            <CameraOffIcon aria-hidden className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            <div className="space-y-1">
              <p className="font-medium">{PROBLEM_TEXT[problem].title}</p>
              <p className="text-sm text-muted-foreground text-pretty">{PROBLEM_TEXT[problem].body}</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button className="h-11 text-base sm:flex-1" onClick={onScan}>
              <CameraIcon aria-hidden /> Try the camera again
            </Button>
            {/* Without a live camera, a photo of the barcode is the next quickest way. */}
            <Button variant="outline" className="h-11 text-base sm:flex-1" nativeButton={false} render={<label htmlFor={`${inputId}-photo`} />}>
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
          </div>
          {photoError && <p className="text-sm text-destructive">{photoError}</p>}
        </div>
      ) : (
        <Button className="h-12 w-full text-base" onClick={onScan}>
          <CameraIcon aria-hidden /> Scan with the camera
        </Button>
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
            autoFocus={focusInput}
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
