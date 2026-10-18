import { SceneSlot } from "@/components/fx/scene-slot";
import { cn } from "@/lib/utils";

const CALM = [
  "radial-gradient(42% 55% at 18% 28%, color-mix(in oklab, var(--brand) 36%, transparent), transparent 70%)",
  "radial-gradient(48% 60% at 82% 18%, color-mix(in oklab, #3a6ea5 30%, transparent), transparent 70%)",
  "radial-gradient(30% 42% at 62% 82%, color-mix(in oklab, var(--finding) 12%, transparent), transparent 70%)",
].join(", ");

const ALERT = [
  "radial-gradient(46% 58% at 22% 30%, color-mix(in oklab, var(--finding) 40%, transparent), transparent 70%)",
  "radial-gradient(48% 60% at 84% 16%, color-mix(in oklab, var(--finding) 26%, transparent), transparent 70%)",
  "radial-gradient(32% 44% at 60% 84%, color-mix(in oklab, #3a6ea5 18%, transparent), transparent 72%)",
].join(", ");

const FADE = "absolute inset-0 transition-opacity duration-[1200ms] ease-out";

/**
 * Soft drifting color behind a hero or a page header: teal and blue, warming to amber when `alert`
 * (crossfade over 1.2 s). Plain gradients and one transform animation, no blur filter (large blurred
 * layers are what iOS Safari drops while scrolling). The CSS stand-in for the Unicorn Studio "aurora"
 * scene: it is that scene's poster, so the scene drops into the same SceneSlot later. Decoration only;
 * never put it behind label text.
 */
export function Aurora({ alert = false, instant = false, className }: { alert?: boolean; instant?: boolean; className?: string }) {
  return (
    <SceneSlot
      className={cn("pointer-events-none absolute inset-0 -z-10", className)}
      poster={
        <div className="absolute -inset-[12%] animate-aurora">
          {/* A true crossfade: teal blended over amber would read as green. */}
          <div className={cn(FADE, instant && "transition-none", alert ? "opacity-0" : "opacity-100")} style={{ backgroundImage: CALM }} />
          <div className={cn(FADE, instant && "transition-none", alert ? "opacity-100" : "opacity-0")} style={{ backgroundImage: ALERT }} />
        </div>
      }
    />
  );
}
