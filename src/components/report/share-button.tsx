"use client";

import { DownloadIcon, Loader2Icon, Share2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "cn";
import { useTimeZone } from "./local-time";

export function reportPdfUrl(patientId: string, timeZone: string | null): string {
  const base = `/api/patients/${patientId}/report.pdf`;
  return timeZone ? `${base}?tz=${encodeURIComponent(timeZone)}` : base;
}

async function fetchReportFile(url: string): Promise<File> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Report request failed (${res.status})`);
  const blob = await res.blob();
  const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "MedCheck-report.pdf";
  return new File([blob], name, { type: "application/pdf" });
}

function saveFile(file: File) {
  const href = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = href;
  a.download = file.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 30_000);
}

export function DownloadButton({ patientId, className }: { patientId: string; className?: string }) {
  const timeZone = useTimeZone();
  return (
    <Button
      nativeButton={false}
      render={<a href={reportPdfUrl(patientId, timeZone)} download />}
      variant="outline"
      className={cn("h-11 px-2 text-sm sm:text-base", className)}
    >
      <DownloadIcon aria-hidden /> Download<span className="-ml-1 hidden sm:inline">PDF</span>
    </Button>
  );
}

type ShareState = { kind: "idle" } | { kind: "preparing" } | { kind: "ready"; file: File } | { kind: "mailto" };

/**
 * Shares the PDF with the phone's share sheet (Mail, Messages, AirDrop…). Where files can't be
 * shared (most desktops), downloads the PDF and opens a prefilled email to attach it to.
 */
export function ShareButton({
  patientId,
  title,
  subject,
  body,
  className,
}: {
  patientId: string;
  title: string;
  subject: string;
  body: string;
  className?: string;
}) {
  const timeZone = useTimeZone();
  const [state, setState] = useState<ShareState>({ kind: "idle" });

  async function share(file: File) {
    try {
      await navigator.share({ files: [file], title, text: body });
      setState({ kind: "idle" });
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      if (name === "AbortError") return setState({ kind: "idle" });
      // Safari drops the tap's permission if preparing the PDF took too long: one more tap shares it.
      if (name === "NotAllowedError") return setState({ kind: "ready", file });
      throw error;
    }
  }

  async function onClick() {
    if (state.kind === "ready") return share(state.file).catch(fail);
    setState({ kind: "preparing" });
    try {
      const file = await fetchReportFile(reportPdfUrl(patientId, timeZone));
      if (navigator.canShare?.({ files: [file] })) return await share(file);
      saveFile(file);
      window.location.assign(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
      setState({ kind: "mailto" });
    } catch (error) {
      fail(error);
    }
  }

  function fail(error: unknown) {
    console.error(error);
    setState({ kind: "idle" });
    toast.error("Couldn't prepare the report. Check your connection and try again.");
  }

  return (
    <div className={cn("flex flex-col", className)}>
      <Button onClick={onClick} disabled={state.kind === "preparing"} className="h-11 w-full px-2 text-sm sm:text-base">
        {state.kind === "preparing" ? <Loader2Icon aria-hidden className="animate-spin" /> : <Share2Icon aria-hidden />}
        {state.kind === "ready" ? "Tap to share PDF" : state.kind === "preparing" ? "Preparing…" : "Share"}
      </Button>
      {state.kind === "mailto" && (
        <p role="status" className="mt-2 text-sm text-muted-foreground">
          The PDF was downloaded. Attach it to the email that just opened.
        </p>
      )}
    </div>
  );
}
