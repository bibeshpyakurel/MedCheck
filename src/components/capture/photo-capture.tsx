"use client";

import { CameraIcon, ImageIcon, ImageUpIcon, LoaderCircleIcon } from "lucide-react";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

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

export type PhotoAction = (formData: FormData) => Promise<{ error: string } | void>;

/**
 * Take or choose a photo, preview it, and submit it (downscaled) with the surrounding form's
 * fields to a Server Action. The photo is sent as `photo`.
 */
export function PhotoCapture({
  action,
  children,
  submitLabel = "Read this photo",
}: {
  action: PhotoAction;
  children?: ReactNode;
  submitLabel?: string;
}) {
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setPreparing(true);
    try {
      let blob: Blob;
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
    } finally {
      setPreparing(false);
    }
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!photo || !formRef.current) return;
    const formData = new FormData(formRef.current);
    formData.delete("camera");
    formData.delete("library");
    formData.set("photo", photo, photo.type === "image/jpeg" ? "label.jpg" : "label");
    setError(null);
    startTransition(async () => {
      const result = await action(formData);
      if (result?.error) setError(result.error);
    });
  }

  const busy = preparing || pending;

  return (
    <form ref={formRef} onSubmit={submit} className="space-y-5">
      {children}

      <div className="space-y-3">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
          <img src={previewUrl} alt="Your photo" className="max-h-80 w-full rounded-2xl border bg-muted object-contain shadow-xs" />
        ) : (
          <div className="grid h-48 place-items-center rounded-2xl border-2 border-dashed bg-surface text-sm text-muted-foreground">
            <span className="flex flex-col items-center gap-2">
              <span className="grid size-11 place-items-center rounded-xl bg-card ring-1 ring-border">
                <ImageUpIcon aria-hidden className="size-5" />
              </span>
              No photo yet
            </span>
          </div>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          <label className="inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border bg-card px-4 text-base font-medium shadow-xs transition-colors hover:border-input hover:bg-muted/70 has-focus-visible:ring-3 has-focus-visible:ring-ring/50">
            <CameraIcon aria-hidden className="size-5" />
            {photo ? "Retake photo" : "Take photo"}
            <input
              type="file"
              name="camera"
              accept="image/*"
              capture="environment"
              className="sr-only"
              disabled={busy}
              onChange={(e) => onFile(e.target.files?.[0])}
            />
          </label>
          <label className="inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border bg-card px-4 text-base font-medium shadow-xs transition-colors hover:border-input hover:bg-muted/70 has-focus-visible:ring-3 has-focus-visible:ring-ring/50">
            <ImageIcon aria-hidden className="size-5" />
            Choose from photos
            <input
              type="file"
              name="library"
              accept="image/*"
              className="sr-only"
              disabled={busy}
              onChange={(e) => onFile(e.target.files?.[0])}
            />
          </label>
        </div>
        <p className="text-sm text-muted-foreground">
          Hold the label flat, fill the frame, and avoid glare. You&apos;ll check every value before it&apos;s saved.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={!photo || busy}>
        {pending ? (
          <>
            <LoaderCircleIcon aria-hidden className="animate-spin" /> Reading the photo…
          </>
        ) : preparing ? (
          "Preparing photo…"
        ) : (
          submitLabel
        )}
      </Button>
    </form>
  );
}
