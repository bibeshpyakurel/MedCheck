"use client";

import { Loader2Icon, MailIcon } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTimeZone } from "./local-time";

type Status = { kind: "idle" } | { kind: "sending" } | { kind: "sent"; to: string } | { kind: "error"; message: string };

/** Email the report PDF to a doctor or pharmacist. Subject and message are prefilled and editable. */
export function EmailForm({
  patientId,
  defaultSubject,
  defaultBody,
  configured,
}: {
  patientId: string;
  defaultSubject: string;
  defaultBody: string;
  configured: boolean;
}) {
  const timeZone = useTimeZone();
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  if (!configured) {
    return (
      <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
        Email isn&apos;t set up on this MedCheck. Use <strong className="text-foreground">Share</strong> to send the PDF from
        your own email or messages app, or <strong className="text-foreground">Download PDF</strong> to attach it yourself.
      </p>
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ kind: "sending" });
    try {
      const res = await fetch(`/api/patients/${patientId}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, body, timeZone: timeZone ?? undefined }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) {
        setStatus({ kind: "error", message: data?.error ?? "The email couldn't be sent. Try again, or use Share." });
        return;
      }
      setStatus({ kind: "sent", to });
      toast.success(`Report sent to ${to}`);
    } catch {
      setStatus({ kind: "error", message: "The email couldn't be sent. Check your connection, or use Share." });
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email-to">To</Label>
        <Input
          id="email-to"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="pharmacist@example.com"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="h-11 text-base"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email-subject">Subject</Label>
        <Input
          id="email-subject"
          required
          maxLength={200}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="h-11 text-base"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email-body">Message</Label>
        <Textarea
          id="email-body"
          rows={9}
          maxLength={10_000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="text-base"
        />
        <p className="text-xs text-muted-foreground">The PDF report is attached automatically.</p>
      </div>
      {status.kind === "error" && (
        <p role="alert" className="text-sm text-destructive">
          {status.message}
        </p>
      )}
      {status.kind === "sent" && (
        <p role="status" className="text-sm text-muted-foreground">
          Sent to {status.to}.
        </p>
      )}
      <Button type="submit" disabled={status.kind === "sending"} className="h-11 w-full text-base">
        {status.kind === "sending" ? <Loader2Icon aria-hidden className="animate-spin" /> : <MailIcon aria-hidden />}
        {status.kind === "sending" ? "Sending…" : "Send"}
      </Button>
    </form>
  );
}
