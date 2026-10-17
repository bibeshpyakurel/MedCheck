"use client";

import { DatabaseIcon, QuoteIcon } from "lucide-react";
import { useState } from "react";
import type { BBox, Evidence } from "@/lib/domain/schema";
import { cn } from "@/lib/utils";

const PAD = 0.015;

function padded(b: BBox): BBox {
  const x = Math.max(0, b.x - PAD);
  const y = Math.max(0, b.y - PAD);
  return { x, y, w: Math.min(1, b.x + b.w + PAD) - x, h: Math.min(1, b.y + b.h + PAD) - y };
}

/** Shows where a value came from: a crop of the photo, the whole photo, the user's words, or the catalog. */
export function EvidenceCrop({
  evidence,
  photoUrl,
  className,
}: {
  evidence: Evidence;
  photoUrl: string | null;
  className?: string;
}) {
  if (evidence.kind === "quote") {
    return (
      <figure className={cn("rounded-lg border bg-muted/40 p-3 text-sm", className)}>
        <figcaption className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <QuoteIcon aria-hidden className="size-3" /> Your words
        </figcaption>
        <blockquote className="italic">&ldquo;{evidence.text}&rdquo;</blockquote>
      </figure>
    );
  }
  if (evidence.kind === "database") {
    return (
      <figure className={cn("rounded-lg border bg-muted/40 p-3 text-sm", className)}>
        <figcaption className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <DatabaseIcon aria-hidden className="size-3" /> FDA label in our catalog
        </figcaption>
        {evidence.text && <p>{evidence.text}</p>}
      </figure>
    );
  }
  if (!photoUrl) {
    return <p className={cn("text-sm text-muted-foreground", className)}>No picture for this value</p>;
  }
  if (evidence.kind === "crop") return <Crop url={photoUrl} bbox={padded(evidence.bbox)} className={className} />;
  return (
    <a href={photoUrl} target="_blank" rel="noreferrer" className={cn("block", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
      <img src={photoUrl} alt="The whole photo" className="max-h-40 w-full rounded-lg border bg-muted object-contain" />
      <span className="sr-only">Open the full photo</span>
    </a>
  );
}

/** CSS crop: the container has the crop's aspect ratio; the image is scaled and shifted inside it. */
function Crop({ url, bbox, className }: { url: string; bbox: BBox; className?: string }) {
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const aspect = natural ? (bbox.w * natural.w) / (bbox.h * natural.h) : 4;
  const measure = (img: HTMLImageElement | null) => {
    if (img && img.complete && img.naturalWidth && !natural) setNatural({ w: img.naturalWidth, h: img.naturalHeight });
  };
  return (
    <a href={url} target="_blank" rel="noreferrer" className={cn("block", className)}>
      {/* ring, not border: a border would shrink the padding box that the % offsets resolve against. */}
      <div
        className="relative overflow-hidden rounded-lg bg-muted ring-1 ring-border"
        style={{ width: "100%", maxWidth: `calc(7rem * ${aspect})`, aspectRatio: aspect }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
        <img
          ref={measure}
          src={url}
          alt="The part of the photo this value was read from"
          onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
          className={cn("absolute h-auto max-w-none", !natural && "invisible")}
          style={{
            width: `${100 / bbox.w}%`,
            left: `${(-bbox.x / bbox.w) * 100}%`,
            top: `${(-bbox.y / bbox.h) * 100}%`,
          }}
        />
      </div>
      <span className="sr-only">Open the full photo</span>
    </a>
  );
}
