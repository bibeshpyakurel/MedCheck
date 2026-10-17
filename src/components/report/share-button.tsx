"use client";

import { DownloadIcon, EyeIcon, Loader2Icon, MailIcon, Share2Icon, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { allowLeave } from "@/components/guest-leave-guard";
import { Button } from "@/components/ui/button";
import { cn } from "cn";
import { useTimeZone } from "./local-time";

export function reportPdfUrl(patientId: string, timeZone: string | null, opts: { inline?: boolean } = {}): string {
  const params = new URLSearchParams();
  if (opts.inline) params.set("inline", "1");
  if (timeZone) params.set("tz", timeZone);
  const query = params.toString();
  return `/api/patients/${patientId}/report.pdf${query ? `?${query}` : ""}`;
}

/** One of the report page's four equal actions: icon over label, a large tap target. */
export const ACTION_CLASS = "h-20 w-full flex-col gap-1.5 px-2 text-base [&_svg:not([class*='size-'])]:size-5";

async function fetchReportFile(url: string): Promise<File> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Report request failed (${res.status})`);
  const blob = await res.blob();
  const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "Medicine-report.pdf";
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

/** Opens the current PDF in a new tab, in the browser's own PDF viewer (iOS Safari included). */
export function PreviewButton({ patientId, className }: { patientId: string; className?: string }) {
  const timeZone = useTimeZone();
  return (
    <Button
      nativeButton={false}
      render={<a href={reportPdfUrl(patientId, timeZone, { inline: true })} target="_blank" rel="noopener" />}
      variant="outline"
      className={cn(ACTION_CLASS, className)}
    >
      <EyeIcon aria-hidden /> Preview report
    </Button>
  );
}

export function DownloadButton({ patientId, className }: { patientId: string; className?: string }) {
  const timeZone = useTimeZone();
  return (
    <Button
      nativeButton={false}
      render={<a href={reportPdfUrl(patientId, timeZone)} download />}
      variant="outline"
      className={cn(ACTION_CLASS, className)}
    >
      <DownloadIcon aria-hidden /> Download PDF
    </Button>
  );
}

type ShareState = { kind: "idle" } | { kind: "preparing" } | { kind: "ready"; file: File } | { kind: "mailto" };

type ShareProps = { patientId: string; title: string; subject: string; body: string; className?: string };

/**
 * Shares the PDF with the phone's share sheet (Mail, Messages, AirDrop…). Where files can't be
 * shared (most desktops), downloads the PDF and opens a prefilled email to attach it to.
 */
function ShareAction({
  patientId,
  title,
  subject,
  body,
  className,
  label,
  readyLabel,
  icon: Icon,
}: ShareProps & { label: string; readyLabel: string; icon: LucideIcon }) {
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
      allowLeave(2_000);
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
      <Button variant="outline" onClick={onClick} disabled={state.kind === "preparing"} className={ACTION_CLASS}>
        {state.kind === "preparing" ? <Loader2Icon aria-hidden className="animate-spin" /> : <Icon aria-hidden />}
        {state.kind === "ready" ? readyLabel : state.kind === "preparing" ? "Preparing…" : label}
      </Button>
      {state.kind === "mailto" && (
        <p role="status" className="mt-2 text-sm text-muted-foreground">
          The PDF was downloaded. Attach it to the email that just opened.
        </p>
      )}
    </div>
  );
}

export function ShareButton(props: ShareProps) {
  return <ShareAction {...props} label="Share" readyLabel="Tap to share PDF" icon={Share2Icon} />;
}

/**
 * "Send by email" when MedCheck can't send email itself: hands the PDF to the person's own email app
 * (the share sheet, where Mail attaches it; or a download plus a prefilled email on a computer).
 */
export function EmailYourselfButton(props: ShareProps) {
  return <ShareAction {...props} label="Send by email" readyLabel="Tap to email PDF" icon={MailIcon} />;
}
