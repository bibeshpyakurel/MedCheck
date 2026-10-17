"use client";

import { LoaderCircleIcon, MicIcon, SquareIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AlreadyGaveBoth } from "@/components/already-gave-both";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { DescribeResponse } from "@/lib/ai/describe";

const MAX_SECONDS = 60;

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return ["audio/webm", "audio/mp4", "audio/ogg"].find((t) => MediaRecorder.isTypeSupported(t));
}

export function DescribeForm({ patientId }: { patientId: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [audio, setAudio] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [gaveBoth, setGaveBoth] = useState<DescribeResponse | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    setRecording(false);
  }

  async function startRecording() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Recording isn't available in this browser. Type the description instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setAudio(new Blob(chunks, { type: recorder.mimeType || mimeType || "audio/webm" }));
      };
      recorderRef.current = recorder;
      recorder.start();
      setAudio(null);
      setSeconds(0);
      setRecording(true);
      const startedAt = Date.now();
      timerRef.current = setInterval(() => {
        const elapsed = Math.round((Date.now() - startedAt) / 1000);
        setSeconds(elapsed);
        if (elapsed >= MAX_SECONDS) stopRecording();
      }, 1000);
    } catch {
      setError("We couldn't use the microphone. Allow microphone access, or type the description instead.");
    }
  }

  async function submit() {
    if (!audio && !text.trim()) return;
    setSending(true);
    setError(null);
    const form = new FormData();
    form.set("patientId", patientId);
    if (audio) form.set("audio", audio, "description");
    else form.set("text", text.trim());
    try {
      const res = await fetch("/api/describe", { method: "POST", body: form });
      const body = (await res.json().catch(() => ({}))) as Partial<DescribeResponse> & { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Something went wrong. Try again.");
      const result = body as DescribeResponse;
      if (result.alreadyGaveBoth) {
        setGaveBoth(result);
        return;
      }
      if (result.entryId) router.push(reviewUrl(result));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setSending(false);
    }
  }

  function reviewUrl(result: DescribeResponse) {
    return `/patients/${patientId}/entries/${result.entryId}/review${result.notice ? `?notice=${result.notice}` : ""}`;
  }

  if (gaveBoth) {
    return (
      <div className="space-y-4">
        <AlreadyGaveBoth defaultOpen />
        {gaveBoth.entryId && (
          <Button nativeButton={false} render={<Link href={reviewUrl(gaveBoth)} />} variant="outline" className="h-12 w-full text-base">
            Continue to the medicine you described
          </Button>
        )}
      </div>
    );
  }

  const busy = sending || recording;

  return (
    <div className="space-y-5">
      <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-xs">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground ring-1 ring-primary/15">
            <MicIcon aria-hidden className="size-5" />
          </span>
          <div>
            <p className="font-semibold">Say it</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Read out the name, the strength (like &ldquo;160 mg per 5 mL&rdquo;) and the directions, as printed.
            </p>
          </div>
        </div>
        {recording ? (
          <Button type="button" variant="destructive" className="h-14 w-full text-base" onClick={stopRecording}>
            <span aria-hidden className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-destructive opacity-60" />
              <span className="relative inline-flex size-2.5 rounded-full bg-destructive" />
            </span>
            <SquareIcon aria-hidden /> Stop recording ({seconds}s)
          </Button>
        ) : (
          <Button type="button" variant="outline" className="h-14 w-full text-base" onClick={startRecording} disabled={sending}>
            <MicIcon aria-hidden /> {audio ? "Record again" : "Start recording"}
          </Button>
        )}
        {audio && !recording && (
          <div className="flex items-center justify-between gap-2 rounded-lg bg-surface px-3 py-1 text-sm ring-1 ring-border">
            <span className="font-medium">Recording ready ({seconds}s).</span>
            <Button type="button" variant="ghost" className="h-11" onClick={() => setAudio(null)}>
              Discard
            </Button>
          </div>
        )}
      </div>

      <div aria-hidden className="flex items-center gap-3 text-xs font-medium tracking-wider text-muted-foreground uppercase">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="describe-text" className="text-base">
          Or type it
        </Label>
        <Textarea
          id="describe-text"
          rows={4}
          value={text}
          disabled={!!audio || busy}
          placeholder="Children's Calmora Fever Relief, 100 mg per 5 mL, give 5 mL every 6 hours"
          onChange={(e) => setText(e.target.value)}
          className="text-base"
        />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button
        type="button"
        size="lg"
        className="h-12 w-full text-base"
        disabled={busy || (!audio && !text.trim())}
        onClick={submit}
      >
        {sending ? (
          <>
            <LoaderCircleIcon aria-hidden className="animate-spin" /> Reading your description…
          </>
        ) : (
          "Continue"
        )}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Entries made this way are marked &ldquo;From your description, not a label&rdquo;.
      </p>
    </div>
  );
}
