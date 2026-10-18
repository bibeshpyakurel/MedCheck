"use client";

// The vitals scan (Save with vitals): the front camera watches the face for 30 seconds while VitalLens
// estimates heart rate and breathing rate → the reading → Save reading, Scan again or Don't save.
// Downsampled frames go to VitalLens through /api/vitallens while the camera is on; nothing of the
// video is kept, and only the numbers are saved. The library (~4 MB) loads when the scan starts.
import { CameraOffIcon, HeartPulseIcon, LoaderCircleIcon, RotateCcwIcon, ScanFaceIcon } from "lucide-react";
import Link from "next/link";
import { unstable_rethrow, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { VitalLens } from "vitallens";
import { saveVitalReadingAction } from "@/app/patients/[patientId]/vitals/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { startLens } from "@/components/vitals/start-lens";
import { cameraProblem, type CameraProblem } from "@/lib/barcode-scan";
import { cn } from "@/lib/utils";
import { faceConfidence, faceInView, scanFailureMessage, scanHint, scanProgress } from "@/lib/vitals-scan";
import { hasAnyValue, readingFromResult, VITALS_NOTE, vitalLines, type VitalReading } from "@/lib/vitals";

type Phase =
  | { kind: "start" }
  | { kind: "scanning" }
  | { kind: "result"; reading: VitalReading }
  | { kind: "camera"; problem: CameraProblem }
  | { kind: "failed"; message: string };

const NO_READING =
  "VitalLens didn't send back a reading. Try again in good light, facing the camera. If it keeps happening, this site's free scans may be used up.";

const CAMERA_TEXT: Record<CameraProblem, { title: string; body: string }> = {
  denied: {
    title: "Camera blocked",
    body: "To check vitals, allow the camera for this site in your browser settings, then try again. Your medicines are saved.",
  },
  insecure: {
    title: "The camera needs a secure page",
    body: "Browsers only open the camera on https:// pages. Open MedCheck at its https:// address. Your medicines are saved.",
  },
  unavailable: {
    title: "The camera didn't start",
    body: "Another app may be using it. Close that app, then try again. Your medicines are saved.",
  },
};

const errorName = (error: unknown) => (error instanceof Error ? error.name : "");

function failedOrNavigating(error: unknown): { error: string } | null {
  try {
    unstable_rethrow(error);
  } catch {
    return null;
  }
  return { error: "Something went wrong. Check your connection and try again." };
}

export function VitalsScan({ patientId }: { patientId: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "start" });
  const [live, setLive] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [face, setFace] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const home = `/patients/${patientId}`;

  const start = useCallback(() => {
    setLive(false);
    setElapsed(0);
    setFace(null);
    setSaveError(null);
    setPhase({ kind: "scanning" });
  }, []);

  const scanning = phase.kind === "scanning";
  useEffect(() => {
    const video = videoRef.current;
    if (!scanning || !video) return;
    let stopped = false;
    let stream: MediaStream | null = null;
    let lens: VitalLens | null = null;
    let latest: unknown = null;
    let timer = 0;

    function release() {
      window.clearInterval(timer);
      try {
        lens?.stopVideoStream();
      } catch {}
      void lens?.close().catch(() => {});
      lens = null;
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
    }

    function finish() {
      if (stopped) return;
      stopped = true;
      release();
      const reading = readingFromResult(latest);
      setPhase(reading ? { kind: "result", reading } : { kind: "failed", message: NO_READING });
    }

    async function begin(video: HTMLVideoElement) {
      if (!navigator.mediaDevices?.getUserMedia) {
        setPhase({ kind: "camera", problem: cameraProblem("", window.isSecureContext) });
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        });
      } catch (error) {
        if (!stopped) setPhase({ kind: "camera", problem: cameraProblem(errorName(error), window.isSecureContext) });
        return;
      }
      if (stopped) return release();

      try {
        const { VitalLens } = await import("vitallens");
        if (stopped) return release();
        // Absolute: the library builds `new URL(proxyUrl + "/resolve-model")`.
        lens = new VitalLens({ method: "vitallens", proxyUrl: `${window.location.origin}/api/vitallens` });
        lens.addEventListener("vitals", (result) => {
          if (stopped) return;
          // A stream reset sends an empty result; keep the last one that has vitals.
          if (readingFromResult(result)) latest = result;
          setFace(faceConfidence(result));
        });
        await startLens(lens, stream, video);
        if (stopped) return release();
      } catch (error) {
        console.warn("VitalLens couldn't start", error);
        if (!stopped) {
          stopped = true;
          release();
          setPhase({ kind: "failed", message: scanFailureMessage(error) });
        }
        return;
      }

      setLive(true);
      const startedAt = performance.now();
      timer = window.setInterval(() => {
        const ms = performance.now() - startedAt;
        setElapsed(ms);
        if (scanProgress(ms).done) finish();
      }, 250);
    }

    void begin(video);
    // Stop, leaving the page, or a finished scan: the camera and VitalLens are released.
    return () => {
      stopped = true;
      release();
    };
  }, [scanning]);

  async function save(reading: VitalReading) {
    setSaving(true);
    setSaveError(null);
    // On success the action redirects to My medicines, replacing this page.
    const r = await saveVitalReadingAction({ patientId, reading }).catch(failedOrNavigating);
    if (r?.error) {
      setSaving(false);
      setSaveError(r.error);
    }
  }

  if (phase.kind === "start") {
    return (
      <section aria-labelledby="vitals-start" className="space-y-4 rounded-2xl border bg-card p-5 text-center">
        <ScanFaceIcon aria-hidden className="mx-auto size-12 text-primary" />
        <h2 id="vitals-start" className="font-display text-xl font-semibold">
          Look at the camera
        </h2>
        <p className="text-pretty text-muted-foreground">
          It takes 30 seconds. Hold still in good light with your face in the oval. The video isn&apos;t saved.
        </p>
        <Button className="h-12 w-full text-base" onClick={start}>
          <HeartPulseIcon aria-hidden /> Start
        </Button>
        <Button variant="ghost" className="h-11 w-full text-base" onClick={() => router.replace(home)}>
          Not now
        </Button>
      </section>
    );
  }

  if (phase.kind === "scanning") {
    const { fraction, secondsLeft } = scanProgress(elapsed);
    return (
      <section aria-label="Vitals scan" className="space-y-4">
        <div className="relative h-[min(40dvh,26rem)] overflow-hidden rounded-2xl bg-black">
          <video
            ref={videoRef}
            className="absolute inset-0 size-full -scale-x-100 object-cover"
            playsInline
            muted
            autoPlay
            aria-label="Front camera preview"
          />
          {/* The oval to keep the face in; everything around it is dimmed. */}
          <div aria-hidden className="absolute inset-0 grid place-items-center">
            <div
              className={cn(
                "aspect-[3/4] h-[78%] rounded-[50%] border-[3px] shadow-[0_0_0_9999px_rgb(0_0_0/0.4)] transition-colors",
                live && faceInView(face) ? "border-primary" : "border-white/90",
              )}
            />
          </div>
          {!live && (
            <div className="absolute inset-0 grid place-items-center text-white">
              <LoaderCircleIcon aria-hidden className="size-8 animate-spin" />
            </div>
          )}
        </div>
        <div className="space-y-2" aria-live="polite">
          <div
            role="progressbar"
            aria-label="Scan progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(fraction * 100)}
            className="h-2 overflow-hidden rounded-full bg-muted"
          >
            <div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${fraction * 100}%` }} />
          </div>
          <p className="flex justify-between text-sm font-medium">
            <span>{live ? scanHint(face) : "Starting the camera…"}</span>
            <span className="tabular-nums text-muted-foreground">{live ? `${secondsLeft} s` : null}</span>
          </p>
        </div>
        <Button variant="outline" className="h-11 w-full text-base" onClick={() => setPhase({ kind: "start" })}>
          Stop
        </Button>
      </section>
    );
  }

  if (phase.kind === "result") {
    const { reading } = phase;
    const readable = hasAnyValue(reading);
    return (
      <section aria-labelledby="vitals-result" className="space-y-4">
        <h2 id="vitals-result" className="font-display text-xl font-semibold">
          Your reading
        </h2>
        <dl className="grid gap-3 sm:grid-cols-2">
          {vitalLines(reading).map((line) => (
            <div key={line.label} className="rounded-2xl border bg-card p-4">
              <dt className="text-sm font-medium text-muted-foreground">{line.label}</dt>
              <dd className="mt-1 font-display text-3xl font-semibold tabular-nums">{line.text}</dd>
              <dd className="mt-1 text-sm text-muted-foreground">{line.confidence}</dd>
            </div>
          ))}
        </dl>
        <p className="text-sm text-muted-foreground">{VITALS_NOTE}</p>
        {!readable && <p className="text-sm">Nothing came through clearly enough to save. Scan again in good light, holding still.</p>}
        {saveError && (
          <Alert variant="destructive">
            <AlertDescription>{saveError}</AlertDescription>
          </Alert>
        )}
        <Actions>
          <Button variant="outline" className="h-11 px-4 text-base" disabled={saving} onClick={() => router.replace(home)}>
            Don&apos;t save
          </Button>
          <Button variant="outline" className="h-11 px-4 text-base" disabled={saving} onClick={start}>
            <RotateCcwIcon aria-hidden /> Scan again
          </Button>
          <Button className="h-11 px-5 text-base" disabled={!readable || saving} onClick={() => save(reading)}>
            {saving ? (
              <>
                <LoaderCircleIcon aria-hidden className="animate-spin" /> Saving…
              </>
            ) : (
              "Save reading"
            )}
          </Button>
        </Actions>
      </section>
    );
  }

  const text =
    phase.kind === "camera" ? CAMERA_TEXT[phase.problem] : { title: "The scan couldn't run", body: phase.message };
  return (
    <section className="space-y-4">
      <Alert variant="destructive">
        <CameraOffIcon aria-hidden />
        <AlertTitle>{text.title}</AlertTitle>
        <AlertDescription>{text.body}</AlertDescription>
      </Alert>
      <Actions>
        <Button variant="outline" className="h-11 px-4 text-base" nativeButton={false} render={<Link href={home} replace />}>
          Go to My medicines
        </Button>
        <Button className="h-11 px-5 text-base" onClick={start}>
          <RotateCcwIcon aria-hidden /> Try again
        </Button>
      </Actions>
    </section>
  );
}

function Actions({ children }: { children: ReactNode }) {
  return <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{children}</div>;
}
