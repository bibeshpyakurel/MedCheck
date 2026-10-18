"use client";

import { DownloadIcon, EyeIcon, Loader2Icon, MailIcon, Share2Icon, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { allowLeave } from "@/components/guest-leave-guard";
import { Button } from "@/components/ui/button";
import { cn } from "cn";
import { useTimeZone } from "./local-time";
import { shareMode } from "./share-mode";

export function reportPdfUrl(patientId: string, timeZone: string | null): string {
  const params = new URLSearchParams();
  if (timeZone) params.set("tz", timeZone);
  const query = params.toString();
  return `/api/patients/${patientId}/report.pdf${query ? `?${query}` : ""}`;
}

/** One of the report page's equal actions: icon over label, a large tap target; the label may wrap. */
export const ACTION_CLASS =
  "h-20 w-full flex-col gap-1.5 px-2 text-center text-sm leading-tight whitespace-normal sm:text-base [&_svg:not([class*='size-'])]:size-5";

/** The main action, above the others: one wide row. */
const FEATURED_CLASS = "h-14 w-full gap-2 text-base [&_svg:not([class*='size-'])]:size-5";

/** The preview's address, with this browser's time zone so "generated at" reads locally. */
function previewHref(patientId: string, timeZone: string | null): string {
  return `/patients/${patientId}/export/preview${timeZone ? `?tz=${encodeURIComponent(timeZone)}` : ""}`;
}

/** Wraps the report thumbnail: a tap opens the preview. Out of the tab order; Preview report is the button for that. */
export function PreviewLink({ patientId, className, children }: { patientId: string; className?: string; children: React.ReactNode }) {
  return (
    <Link href={previewHref(patientId, useTimeZone())} tabIndex={-1} aria-hidden className={className}>
      {children}
    </Link>
  );
}

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

/** `disabled`: there's nothing to share yet (no confirmed medicine). */
type ActionProps = { patientId: string; className?: string; disabled?: boolean };

/** Opens the report preview inside MedCheck (with the way back to the report page and its actions). */
export function PreviewButton({ patientId, className, disabled = false }: ActionProps) {
  const href = previewHref(patientId, useTimeZone());
  return (
    <Button
      variant="outline"
      className={cn(ACTION_CLASS, className)}
      disabled={disabled}
      {...(disabled ? {} : { nativeButton: false, render: <Link href={href} /> })}
    >
      <EyeIcon aria-hidden /> Preview report
    </Button>
  );
}

export function DownloadButton({ patientId, className, disabled = false }: ActionProps) {
  const timeZone = useTimeZone();
  return (
    <Button
      variant="outline"
      className={cn(ACTION_CLASS, className)}
      disabled={disabled}
      {...(disabled ? {} : { nativeButton: false, render: <a href={reportPdfUrl(patientId, timeZone)} download /> })}
    >
      <DownloadIcon aria-hidden /> Download PDF
    </Button>
  );
}

const noop = () => () => {};
let canShareFilesCache: boolean | undefined;

/** Whether this browser can hand a PDF file to the share sheet (phones); null during the server render. */
function useCanShareFiles(): boolean | null {
  return useSyncExternalStore(
    noop,
    () =>
      (canShareFilesCache ??=
        navigator.canShare?.({ files: [new File([""], "report.pdf", { type: "application/pdf" })] }) ?? false),
    () => null,
  );
}

type ShareState = { kind: "idle" } | { kind: "preparing" } | { kind: "ready"; file: File } | { kind: "mailto" };

type ShareProps = { patientId: string; title: string; subject: string; body: string; className?: string; disabled?: boolean };

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
  disabled = false,
  label,
  readyLabel,
  icon: Icon,
  featured = false,
}: ShareProps & { label: string; readyLabel: string; icon: LucideIcon; featured?: boolean }) {
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
      <Button
        variant={featured ? "default" : "outline"}
        onClick={onClick}
        disabled={disabled || state.kind === "preparing"}
        className={featured ? FEATURED_CLASS : ACTION_CLASS}
      >
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

/**
 * "Share" with the share sheet where the PDF file can be shared. Elsewhere it can only download the PDF
 * and open a prefilled email, so it says "Download and email" — or isn't shown when "Send by email"
 * (`emailConfigured` false: your own email app) already does exactly that.
 */
export function ShareButton({ emailConfigured, featured = false, ...props }: ShareProps & { emailConfigured: boolean; featured?: boolean }) {
  const mode = shareMode({ canShareFiles: useCanShareFiles(), emailConfigured });
  if (mode === "hidden") return null;
  const label = mode === "share" ? "Share" : "Download and email";
  return <ShareAction {...props} featured={featured} label={label} readyLabel="Tap to share PDF" icon={Share2Icon} />;
}

/**
 * "Send by email" when MedCheck can't send email itself: hands the PDF to the person's own email app
 * (the share sheet, where Mail attaches it; or a download plus a prefilled email on a computer).
 */
export function EmailYourselfButton(props: ShareProps) {
  return <ShareAction {...props} label="Send by email" readyLabel="Tap to email PDF" icon={MailIcon} />;
}
