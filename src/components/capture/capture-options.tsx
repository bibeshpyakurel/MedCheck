"use client";

import { CameraIcon, ImageIcon, LoaderCircleIcon, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useState, useTransition, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { setPendingPhoto } from "./pending-photo";

export type PhotoSource = "camera" | "library";

const tileClass =
  "group flex h-full min-h-28 w-full cursor-pointer items-center gap-4 rounded-2xl border bg-card p-5 text-left shadow-xs transition-[border-color,box-shadow] hover:border-primary/40 hover:shadow-md sm:min-h-44 sm:flex-col sm:items-start sm:gap-5 sm:p-6";

function TileBody({ icon: Icon, title, detail, busy }: { icon: LucideIcon; title: string; detail: string; busy?: boolean }) {
  return (
    <>
      <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
        {busy ? <LoaderCircleIcon aria-hidden className="size-7 animate-spin" /> : <Icon aria-hidden className="size-7" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-semibold">{title}</span>
        <span className="mt-0.5 block text-sm text-muted-foreground">{detail}</span>
      </span>
    </>
  );
}

/**
 * The two ways in: take a photo (opens the camera) or choose a photo (opens the library). A picked
 * photo goes to `{base}/photo?source=camera|library`, already loaded.
 */
export function CaptureOptions({ base }: { base: string }) {
  const router = useRouter();
  const [opening, startOpening] = useTransition();
  const [picked, setPicked] = useState<PhotoSource | null>(null);
  const inputs = useRef<Partial<Record<PhotoSource, HTMLInputElement | null>>>({});

  function openPhoto(source: PhotoSource, input: HTMLInputElement) {
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    setPendingPhoto(file);
    setPicked(source);
    startOpening(() => router.push(`${base}/photo?source=${source}`));
  }

  // A photo picked before the page finished loading fired no change event; pick it up now.
  const openEarlyPhoto = useEffectEvent((source: PhotoSource, input: HTMLInputElement) => openPhoto(source, input));
  useEffect(() => {
    for (const [source, input] of Object.entries(inputs.current) as [PhotoSource, HTMLInputElement | null][]) {
      if (input?.files?.length) queueMicrotask(() => openEarlyPhoto(source, input));
    }
  }, []);

  function photoTile(source: PhotoSource, icon: LucideIcon, title: string, detail: string): ReactNode {
    return (
      <label className={cn(tileClass, "has-focus-visible:ring-3 has-focus-visible:ring-ring/50", opening && "pointer-events-none")}>
        <TileBody icon={icon} title={title} detail={detail} busy={opening && picked === source} />
        <input
          type="file"
          accept="image/*"
          capture={source === "camera" ? "environment" : undefined}
          className="sr-only"
          disabled={opening}
          ref={(el) => {
            inputs.current[source] = el;
          }}
          onChange={(e) => openPhoto(source, e.target)}
        />
      </label>
    );
  }

  return (
    <>
      <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        <li>{photoTile("camera", CameraIcon, "Take a photo", "Opens your camera.")}</li>
        <li>{photoTile("library", ImageIcon, "Choose a photo", "From your photo library.")}</li>
      </ul>
      <p role="status" className="sr-only">
        {opening ? "Opening your photo…" : null}
      </p>
    </>
  );
}
