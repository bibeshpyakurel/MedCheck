"use client";

import { ArrowLeftIcon, CameraIcon, ImageIcon, ImageUpIcon, LoaderCircleIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useState, useTransition, type ReactNode } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PhotoAnswersDialog } from "@/components/photo-answers/photo-answers-dialog";
import { opensPhotoAnswers } from "@/lib/photo-answers";
import type { PhotoReadResult } from "@/lib/photo-flow";
import { cn } from "@/lib/utils";
import type { PhotoSource } from "./capture-options";
import { takePendingPhoto } from "./pending-photo";
import { ScanFrame } from "./scan-frame";

const MAX_DIMENSION = 2000;
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/** Downscales to ≤2000px on the long side and re-encodes as JPEG (respecting EXIF rotation). */
async function downscaleToJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  for (const quality of [0.85, 0.7, 0.55]) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob && blob.size <= MAX_UPLOAD_BYTES) return blob;
  }
  throw new Error("Photo too large");
}

export type PhotoAction = (formData: FormData) => Promise<{ error: string } | PhotoReadResult>;

const READ_FAILED = "We couldn't read the photo. Check your connection and try again.";

/**
 * Take or choose a photo; it is read at once: shrunk, then sent with the surrounding form's fields to
 * a Server Action as `photo`. A photo picked on the capture page arrives already loaded and is read
 * straight away; otherwise `source` puts the camera or the library button first. When reading fails
 * the photo stays, "Try again" reads it again, and `otherWaysHref` offers another way to add the
 * medicine. Cancel while reading keeps the photo; the read can't be stopped on the server, so its
 * drafts go to `discardAction` when it finishes. What follows a successful read is `afterRead`.
 */
export function PhotoCapture({
  patientId,
  action,
  discardAction,
  children,
  otherWaysHref,
  source,
}: {
  patientId: string;
  action: PhotoAction;
  discardAction: (entryIds: string[]) => Promise<void>;
  children?: ReactNode;
  otherWaysHref: string;
  source?: PhotoSource;
}) {
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The action failed with this photo: offer the same photo again rather than a fresh start.
  const [failed, setFailed] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [reading, setReading] = useState(false);
  const [leaving, startLeaving] = useTransition();
  // A package photo that was read: its pop-up, open or closed (closed: its drafts wait for review).
  const [answers, setAnswers] = useState<{ sourceDocumentId: string; open: boolean } | null>(null);
  // Each read gets a number; Cancel bumps it, so a read that finishes afterwards is known to be cancelled.
  const attempt = useRef(0);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const medicinesHref = `/patients/${patientId}`;

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  /** A new photo: shrink it, show it, and read it straight away. */
  async function onFile(file: File | undefined) {
    if (!file) return;
    setAnswers(null);
    setError(null);
    setFailed(false);
    setPreparing(true);
    let blob: Blob;
    try {
      try {
        blob = await downscaleToJpeg(file);
      } catch {
        // Browsers that can't decode the format (e.g. HEIC outside Safari): send the original if small enough.
        if (file.size > MAX_UPLOAD_BYTES) throw new Error("too large");
        blob = file;
      }
      setPhoto(blob);
      setPreviewUrl(URL.createObjectURL(blob));
    } catch {
      setPhoto(null);
      setPreviewUrl(null);
      setError("We couldn't use that photo. Try taking it again, a little closer.");
      return;
    } finally {
      setPreparing(false);
    }
    await read(blob);
  }

  // A photo picked on the capture page: load (and read) it once, on arrival.
  const loadPhoto = useEffectEvent((file: File) => void onFile(file));
  useEffect(() => {
    const file = takePendingPhoto();
    if (file) queueMicrotask(() => loadPhoto(file));
  }, []);

  async function read(blob: Blob) {
    if (!formRef.current) return;
    const formData = new FormData(formRef.current);
    formData.delete("camera");
    formData.delete("library");
    formData.set("photo", blob, blob.type === "image/jpeg" ? "label.jpg" : "label");
    setError(null);
    setFailed(false);
    setReading(true);
    const id = ++attempt.current;
    const result = await action(formData).catch((): { error: string } => ({ error: READ_FAILED }));
    if (id !== attempt.current) {
      if ("entryIds" in result) void discardAction(result.entryIds).catch(console.error);
      return;
    }
    if ("error" in result) {
      setReading(false);
      setError(result.error);
      setFailed(true);
      return;
    }
    afterRead(result);
  }

  /**
   * After a successful read: the one place that decides what comes next. A medicine package with
   * something read opens the photo pop-up over this page ("Is this …?"). Anything else replaces this
   * page in history with the action's `next` page (Back then skips the photo step); "Reading the
   * photo…" stays up until that page arrives.
   */
  function afterRead(result: PhotoReadResult) {
    if (opensPhotoAnswers(result)) {
      setReading(false);
      setAnswers({ sourceDocumentId: result.sourceDocumentId, open: true });
      return;
    }
    startLeaving(() => router.replace(result.next));
  }

  /** Cancel or Don't save in the pop-up: what was read is gone; start again with no photo. */
  function startOver() {
    setAnswers(null);
    setPhoto(null);
    setPreviewUrl(null);
  }

  const pending = reading || leaving;
  const busy = preparing || pending;
  const status = pending ? "Reading the photo…" : preparing ? "Preparing photo…" : null;

  /** "Try again" (after a failed read) or "Read this photo" (after Cancel): the same photo, read again. */
  function readAgain(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (photo && !busy) void read(photo);
  }

  function cancel() {
    attempt.current++;
    setReading(false);
  }

  return (
    <form ref={formRef} onSubmit={readAgain} className="space-y-5">
      <div className="space-y-3">
        {previewUrl ? (
          <ScanFrame src={previewUrl} scanning={pending} />
        ) : (
          <div className="grid h-40 place-items-center rounded-2xl border-2 border-dashed bg-surface text-sm text-muted-foreground">
            <span className="flex flex-col items-center gap-2">
              <span className="grid size-11 place-items-center rounded-xl bg-card ring-1 ring-border">
                {preparing ? (
                  <LoaderCircleIcon aria-hidden className="size-5 animate-spin" />
                ) : (
                  <ImageUpIcon aria-hidden className="size-5" />
                )}
              </span>
              {preparing ? "Preparing photo…" : "No photo yet"}
            </span>
          </div>
        )}

        {/* What's happening to the photo. The first photo's "Preparing" shows in the placeholder above. */}
        <p
          role="status"
          className={cn(
            "flex h-12 items-center justify-center gap-2 rounded-lg bg-muted text-base font-medium",
            !(pending || (preparing && previewUrl)) && "sr-only",
          )}
        >
          {status && (
            <>
              <LoaderCircleIcon aria-hidden className="size-5 animate-spin" /> {status}
            </>
          )}
        </p>

        <div className={cn("flex flex-col gap-2 sm:flex-row", source === "library" && "flex-col-reverse sm:flex-row-reverse")}>
          <PickerButton
            name="camera"
            capture
            primary={!photo && source === "camera"}
            disabled={busy}
            icon={<CameraIcon aria-hidden className="size-5" />}
            label={photo ? "Retake photo" : "Take a photo"}
            onFile={onFile}
          />
          <PickerButton
            name="library"
            primary={!photo && source === "library"}
            disabled={busy}
            icon={<ImageIcon aria-hidden className="size-5" />}
            label={photo ? "Choose a different photo" : "Choose a photo"}
            onFile={onFile}
          />
        </div>
        {!photo && (
          <p className="text-sm text-muted-foreground">
            Fill the frame with the front of the package or the label, and avoid glare.
          </p>
        )}
      </div>

      {children}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {reading && !leaving && (
        <Button type="button" variant="outline" size="lg" className="h-12 w-full text-base" onClick={cancel}>
          Cancel
        </Button>
      )}
      {/* The pop-up was closed without Save or Don't save: what was read waits for review. */}
      {answers && !answers.open && (
        <div role="status" className="space-y-3 rounded-2xl border bg-surface p-4">
          <p className="text-sm text-pretty">
            <span className="font-medium">Not saved yet.</span> What MedCheck read from this photo is waiting for review on My medicines.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" className="h-11 px-4 text-base" onClick={() => setAnswers({ ...answers, open: true })}>
              Check the medicines again
            </Button>
            <Button variant="outline" className="h-11 px-4 text-base" nativeButton={false} render={<Link href={medicinesHref} replace />}>
              Go to My medicines
            </Button>
          </div>
        </div>
      )}
      {/* A new photo is read without a tap; this button only appears after a failed or cancelled read. */}
      {photo && !busy && !answers && (
        <Button type="submit" size="lg" className="h-12 w-full text-base">
          {failed ? "Try again" : "Read this photo"}
        </Button>
      )}
      {failed && !busy && (
        <Button variant="outline" size="lg" className="h-12 w-full text-base" nativeButton={false} render={<Link href={otherWaysHref} />}>
          <ArrowLeftIcon aria-hidden /> Choose another way
        </Button>
      )}
      {answers?.open && (
        <PhotoAnswersDialog
          patientId={patientId}
          sourceDocumentId={answers.sourceDocumentId}
          photoUrl={previewUrl}
          onClose={() => setAnswers({ ...answers, open: false })}
          onDiscarded={startOver}
        />
      )}
    </form>
  );
}

/** A tap-sized button that opens the camera (`capture`) or the photo library. */
function PickerButton({
  name,
  capture = false,
  primary,
  disabled,
  icon,
  label,
  onFile,
}: {
  name: "camera" | "library";
  capture?: boolean;
  primary: boolean;
  disabled: boolean;
  icon: ReactNode;
  label: string;
  onFile: (file: File | undefined) => void;
}) {
  return (
    <label
      className={cn(
        "inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-base font-medium shadow-xs transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50 has-disabled:cursor-not-allowed has-disabled:opacity-50 sm:flex-1",
        primary
          ? "border-transparent bg-primary text-primary-foreground hover:bg-primary/90"
          : "bg-card hover:border-input hover:bg-muted/70",
      )}
    >
      {icon}
      {label}
      <input
        type="file"
        name={name}
        accept="image/*"
        capture={capture ? "environment" : undefined}
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </label>
  );
}
